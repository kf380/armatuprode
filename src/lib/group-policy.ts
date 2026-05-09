/**
 * Centralized policy decisions for groups (PERSONAL + ORGANIZATION).
 *
 * Rules live here so both API handlers and (later) UI helpers query the same
 * source. Backend is authoritative — UI hints are derived, never trusted.
 */

import type { Group, GroupMember, GroupStatus } from "@prisma/client";
import { resolveLimits } from "@/lib/plans";

export type PolicyResult =
  | { ok: true }
  | { ok: false; reason: string; status: number };

/**
 * Can a user JOIN a group as a player?
 *  - status must be ACTIVE
 *  - participantLimit not yet reached
 *  - group must not be CANCELLED/PAUSED/etc
 */
export function canJoinGroup(
  group: Pick<Group, "status" | "participantLimit">,
  currentMemberCount: number,
): PolicyResult {
  if (group.status !== "ACTIVE") {
    return {
      ok: false,
      reason: groupStatusBlockReason(group.status),
      status: 403,
    };
  }
  if (currentMemberCount >= group.participantLimit) {
    return {
      ok: false,
      reason: `Cupo lleno: máximo ${group.participantLimit} participantes`,
      status: 403,
    };
  }
  return { ok: true };
}

/**
 * Can the user EDIT prize/rules/branding for this group?
 *  - must be group creator OR organization OWNER/ADMIN (if it's an org group)
 */
export function canEditGroup(args: {
  group: Pick<Group, "createdById" | "organizationId">;
  userId: string;
  /** Pass the user's role in the org (if any), or null. */
  orgRole?: "OWNER" | "ADMIN" | "PLAYER" | null;
}): PolicyResult {
  if (args.group.createdById === args.userId) return { ok: true };
  if (args.group.organizationId && (args.orgRole === "OWNER" || args.orgRole === "ADMIN")) {
    return { ok: true };
  }
  return { ok: false, reason: "Solo el creador puede editar este prode", status: 403 };
}

/**
 * Can the user VIEW billing details (plan, payments, status)?
 *  - more restrictive: only group creator OR org OWNER
 */
export function canViewBilling(args: {
  group: Pick<Group, "createdById" | "organizationId">;
  userId: string;
  orgRole?: "OWNER" | "ADMIN" | "PLAYER" | null;
}): PolicyResult {
  if (args.group.createdById === args.userId) return { ok: true };
  if (args.group.organizationId && args.orgRole === "OWNER") {
    return { ok: true };
  }
  return { ok: false, reason: "Solo el dueño puede ver la facturación", status: 403 };
}

/**
 * Can the user RESUME PAYMENT on a premium group?
 *  - must be group creator (only creator pays in this evolution)
 *  - status must be in {PENDING_PAYMENT, PAYMENT_FAILED, PAYMENT_REVERSED}
 *  - planType must NOT be FREE (FREE never goes through MP)
 *  - planType must NOT be WHITE_LABEL (internal-only, no public price)
 */
export function canResumePayment(args: {
  group: Pick<Group, "createdById" | "status" | "planType" | "isPremium" | "billingStatus">;
  userId: string;
}): PolicyResult {
  if (args.group.createdById !== args.userId) {
    return { ok: false, reason: "Solo el creador puede reintentar el pago", status: 403 };
  }
  if (args.group.planType === "FREE") {
    return { ok: false, reason: "Este prode es gratuito, no requiere pago", status: 400 };
  }
  if (args.group.planType === "WHITE_LABEL") {
    return { ok: false, reason: "Plan no disponible para reintento de pago", status: 403 };
  }
  if (args.group.status === "ACTIVE" && args.group.isPremium && args.group.billingStatus === "PAID") {
    return { ok: false, reason: "El prode ya está activo y pago", status: 400 };
  }
  const resumableStatuses: Array<typeof args.group.status> = [
    "PENDING_PAYMENT",
    "PAYMENT_FAILED",
    "PAYMENT_REVERSED",
  ];
  if (!resumableStatuses.includes(args.group.status)) {
    return {
      ok: false,
      reason: `No se puede reiniciar pago en estado ${args.group.status}`,
      status: 409,
    };
  }
  return { ok: true };
}

/**
 * When a creator hits "Retomar pago" and we already have a PENDING
 * PaymentOrder for the same group + plan + amount, we have three options:
 *
 *   1. REUSE   — return the existing initPoint (idempotent, no new MP charge)
 *   2. WARN    — refuse and show "ya hay un pago abierto, esperá X minutos"
 *   3. REPLACE — mark the old order EXPIRED and create a fresh preference
 *
 * The choice depends on how OLD the existing PENDING order is. MP preferences
 * have an internal expiration (~24h by default, configurable), but UX-wise we
 * want to handle three time buckets.
 *
 * TODO(human): implement classifyPendingOrder() — given the age (in seconds)
 * of the existing PENDING PaymentOrder, return the action the resume-payment
 * endpoint should take. Keep it pure (no DB calls). Suggested signature:
 *
 *   export function classifyPendingOrder(ageSeconds: number):
 *     | { action: "REUSE" }
 *     | { action: "WARN"; minutesLeft: number }
 *     | { action: "REPLACE" }
 *
 * Considerations:
 *  - "WARN" should kick in only briefly (eg the user just clicked Pagar in
 *    another tab seconds ago and might be mid-checkout). If we WARN forever
 *    we lock the user out when MP times out silently.
 *  - "REUSE" is fine for a fairly long window (the same MP preference can be
 *    re-opened) — keep it the default for the majority of cases.
 *  - "REPLACE" should fire only when the old preference is clearly stale
 *    (eg older than the MP preference TTL, default 24h). Replacing too eagerly
 *    creates duplicate orders that pollute reports.
 *
 * Pick the windows you think fit the user's reality. Document them in a short
 * comment so future-you can revisit.
 */

// Windows: WARN 0-90s (probable doble pestaña), REUSE 90s-6h (preferencia MP
// sigue viva, evita cobrar de nuevo), REPLACE >6h (precio/plan/jugadores ya
// pueden haber cambiado; vale crear preferencia limpia).
export type PendingOrderAction =
  | { action: "REUSE" }
  | { action: "WARN"; minutesLeft: number }
  | { action: "REPLACE" };

export function classifyPendingOrder(ageSeconds: number): PendingOrderAction {
  if (ageSeconds < 0) return { action: "REUSE" };
  const WARN_MAX = 90;
  const REUSE_MAX = 6 * 60 * 60;
  if (ageSeconds < WARN_MAX) {
    const minutesLeft = Math.max(1, Math.ceil((WARN_MAX - ageSeconds) / 60));
    return { action: "WARN", minutesLeft };
  }
  if (ageSeconds < REUSE_MAX) return { action: "REUSE" };
  return { action: "REPLACE" };
}

/** Capacity check independent of status. */
export function isAtCapacity(
  group: Pick<Group, "participantLimit">,
  currentMembers: GroupMember[] | number,
): boolean {
  const count = typeof currentMembers === "number" ? currentMembers : currentMembers.length;
  return count >= group.participantLimit;
}

/** Compute the participantLimit a group should have given its plan. */
export function limitFromPlan(planType: Group["planType"]): number {
  return resolveLimits(planType).maxPlayers;
}

function groupStatusBlockReason(status: GroupStatus): string {
  switch (status) {
    case "DRAFT":
      return "El prode todavía no fue activado";
    case "PENDING_PAYMENT":
      return "El prode está esperando confirmación de pago";
    case "PAUSED":
      return "El prode está pausado";
    case "FINISHED":
      return "El prode ya finalizó";
    case "CANCELLED":
      return "El prode fue cancelado";
    case "PAYMENT_FAILED":
      return "El pago no se pudo completar";
    case "PAYMENT_REVERSED":
      return "El pago fue reembolsado, el prode no está activo";
    default:
      return "El prode no está disponible";
  }
}
