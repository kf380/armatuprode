/**
 * Phase 2 — MANUAL_POOL payment tracking.
 *
 * The organizer marks each player as "paid" / "not paid" for their entry.
 * ArmaTuProde NEVER touches the money — this table is only a shared
 * tablero. The organizer collects the money by their own means
 * (transferencia, MP propio, efectivo).
 *
 * Endpoints:
 *   GET  /api/groups/[id]/pool-tracking            → list of all members + paid status
 *   POST /api/groups/[id]/pool-tracking            → upsert {userId, paid, note?}
 *   DELETE /api/groups/[id]/pool-tracking?userId=  → reset (mark unpaid)
 *
 * Gates:
 *   - enableManualPools flag must be ON
 *   - group.moneyMode must be MANUAL_POOL
 *   - canEditGroup policy (creator OR org OWNER/ADMIN)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { canEditGroup } from "@/lib/group-policy";
import { flags } from "@/lib/flags";
import { log } from "@/lib/log";
import type { OrgMemberRole } from "@prisma/client";

async function loadGroupAndPolicy(
  request: NextRequest,
  id: string,
): Promise<
  | { ok: false; res: NextResponse }
  | { ok: true; dbUser: { id: string }; group: NonNullable<Awaited<ReturnType<typeof prisma.group.findUnique>>> }
> {
  const { user } = await getAuthUser(request);
  if (!user) return { ok: false, res: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };

  if (!flags.enableManualPools()) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Feature de pozo manual no disponible" }, { status: 403 }),
    };
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return { ok: false, res: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) };

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return { ok: false, res: NextResponse.json({ error: "Prode no encontrado" }, { status: 404 }) };

  if (group.moneyMode !== "MANUAL_POOL") {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Este prode no usa modo Pozo declarado" },
        { status: 400 },
      ),
    };
  }

  let orgRole: OrgMemberRole | null = null;
  if (group.organizationId) {
    const m = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: group.organizationId, userId: dbUser.id } },
    });
    orgRole = m?.role ?? null;
  }
  const policy = canEditGroup({ group, userId: dbUser.id, orgRole });
  if (!policy.ok) {
    return { ok: false, res: NextResponse.json({ error: policy.reason }, { status: policy.status }) };
  }

  return { ok: true, dbUser, group };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await loadGroupAndPolicy(request, id);
  if (!ctx.ok) return ctx.res;

  const members = await prisma.groupMember.findMany({
    where: { groupId: id },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { joinedAt: "asc" },
  });
  const trackings = await prisma.poolPaymentTracking.findMany({
    where: { groupId: id },
  });
  const trackingByUser = new Map(trackings.map((t) => [t.userId, t]));

  const list = members.map((m) => {
    const t = trackingByUser.get(m.userId);
    return {
      userId: m.userId,
      name: m.user.name,
      avatar: m.user.avatar,
      role: m.role,
      paid: t?.paid ?? false,
      paidAt: t?.paidAt?.toISOString() ?? null,
      note: t?.note ?? null,
    };
  });

  const declaredPoolEntry = ctx.group.declaredPoolEntry ?? 0;
  const paidCount = list.filter((p) => p.paid).length;
  const totalDeclared = declaredPoolEntry * list.length;
  const totalCollected = declaredPoolEntry * paidCount;

  return NextResponse.json({
    moneyMode: ctx.group.moneyMode,
    declaredPoolEntry,
    declaredPoolCurrency: ctx.group.declaredPoolCurrency ?? "ARS",
    totalDeclared,
    totalCollected,
    paidCount,
    pendingCount: list.length - paidCount,
    members: list,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await loadGroupAndPolicy(request, id);
  if (!ctx.ok) return ctx.res;

  const body = await request.json().catch(() => ({}));
  const { userId, paid, note } = body as { userId?: string; paid?: boolean; note?: string | null };

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  // Only members of this group can be tracked.
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: id } },
  });
  if (!member) {
    return NextResponse.json({ error: "Ese jugador no es miembro del prode" }, { status: 404 });
  }

  const isPaid = paid === true;
  const trimmedNote =
    typeof note === "string" ? note.trim().slice(0, 280) || null : note === null ? null : undefined;

  const tracking = await prisma.poolPaymentTracking.upsert({
    where: { groupId_userId: { groupId: id, userId } },
    create: {
      groupId: id,
      userId,
      paid: isPaid,
      paidAt: isPaid ? new Date() : null,
      markedById: ctx.dbUser.id,
      note: trimmedNote ?? null,
    },
    update: {
      paid: isPaid,
      paidAt: isPaid ? new Date() : null,
      markedById: ctx.dbUser.id,
      ...(trimmedNote !== undefined ? { note: trimmedNote } : {}),
    },
  });

  log("info", "pool_tracking_updated", {
    groupId: id,
    userId,
    paid: isPaid,
    markedById: ctx.dbUser.id,
  });

  return NextResponse.json({ tracking });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ctx = await loadGroupAndPolicy(request, id);
  if (!ctx.ok) return ctx.res;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId requerido" }, { status: 400 });
  }

  await prisma.poolPaymentTracking.deleteMany({
    where: { groupId: id, userId },
  });

  log("info", "pool_tracking_reset", { groupId: id, userId, byUserId: ctx.dbUser.id });
  return NextResponse.json({ ok: true });
}
