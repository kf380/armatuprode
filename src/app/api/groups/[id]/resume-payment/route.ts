import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/ratelimit";
import { createMPPreference } from "@/lib/mercadopago";
import { canResumePayment, classifyPendingOrder } from "@/lib/group-policy";
import { PLANS, isPublicPlan, priceFor } from "@/lib/plans";
import { log } from "@/lib/log";
import type { PlanType } from "@prisma/client";

/**
 * Re-initiate a GROUP_ACTIVATION payment for a group that is stuck in
 * PENDING_PAYMENT, PAYMENT_FAILED, or PAYMENT_REVERSED. Reuses group's current
 * planType by default; client may override (must still be public + compatible).
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rl = await rateLimit("paymentsCreate", user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos de pago, esperá un momento" },
      { status: 429 },
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Prode no encontrado" }, { status: 404 });

  // Policy: creator + status in {PENDING, FAILED, REVERSED} + plan != FREE/WHITE_LABEL
  const policy = canResumePayment({ group, userId: dbUser.id });
  if (!policy.ok) {
    return NextResponse.json({ error: policy.reason }, { status: policy.status });
  }

  const body = await request.json().catch(() => ({}));
  const overridePlan = (body as { planType?: PlanType }).planType;
  const overridePlayers = (body as { estimatedPlayers?: number }).estimatedPlayers;

  // Resolve plan to charge: override (validated) or fall back to group.planType
  const planType: PlanType = overridePlan ?? group.planType;
  if (!(planType in PLANS) || !isPublicPlan(planType)) {
    return NextResponse.json({ error: "Plan no disponible" }, { status: 403 });
  }
  const planConfig = PLANS[planType];

  // Cross-validation: planType must match group.type
  if (planConfig.groupType !== group.type) {
    return NextResponse.json(
      { error: `Plan ${planType} no es compatible con prodes ${group.type}` },
      { status: 400 },
    );
  }
  if (planType === "FREE") {
    return NextResponse.json(
      { error: "FREE no requiere pago. Usá /api/groups/[id]/activate." },
      { status: 400 },
    );
  }

  // Compute price quote (estimatedPlayers default = current memberCount or plan minimum size)
  const memberCount = await prisma.groupMember.count({ where: { groupId: group.id } });
  const players =
    Number.isInteger(overridePlayers) && (overridePlayers ?? 0) > 0
      ? (overridePlayers as number)
      : Math.max(
          memberCount,
          planConfig.minimumUsd > 0
            ? Math.ceil(planConfig.minimumUsd / Math.max(1, planConfig.pricePerPlayerUsd))
            : 0,
        );
  const quote = priceFor(planType, players);
  if (quote.amountArs <= 0) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }

  // If group has an outstanding PENDING order for the same plan + amount,
  // decide REUSE / WARN / REPLACE based on its age (group-policy decision).
  const existingPending = await prisma.paymentOrder.findFirst({
    where: {
      userId: dbUser.id,
      type: "GROUP_ACTIVATION",
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });
  if (existingPending) {
    const meta = existingPending.metadata as { groupId?: string; planType?: string } | null;
    const sameOrder =
      meta?.groupId === group.id &&
      meta.planType === planType &&
      existingPending.amount === quote.amountArs &&
      !!existingPending.preferenceId;
    if (sameOrder) {
      const ageSeconds = Math.floor((Date.now() - existingPending.createdAt.getTime()) / 1000);
      const decision = classifyPendingOrder(ageSeconds);
      if (decision.action === "WARN") {
        return NextResponse.json(
          {
            error: `Ya hay un pago abierto para este prode. Esperá ~${decision.minutesLeft} min o terminá el pago en la otra pestaña.`,
            code: "PENDING_PAYMENT_OPEN",
            minutesLeft: decision.minutesLeft,
          },
          { status: 409 },
        );
      }
      if (decision.action === "REUSE") {
        log("info", "resume_payment_reused_pending", {
          groupId: group.id,
          orderId: existingPending.id,
          ageSeconds,
        });
        // MP preference can be re-opened with its own initPoint. Since we
        // don't persist initPoint, rebuild it from the preferenceId.
        const reuseInitPoint =
          process.env.MP_USE_SANDBOX === "true"
            ? `https://sandbox.mercadopago.com.ar/checkout/v1/payment/redirect?preference-id=${existingPending.preferenceId}`
            : `https://www.mercadopago.com.ar/checkout/v1/payment/redirect?preference-id=${existingPending.preferenceId}`;
        return NextResponse.json({
          initPoint: reuseInitPoint,
          orderId: existingPending.id,
          reused: true,
        });
      }
      // REPLACE: mark stale, fall through to create a fresh PaymentOrder.
      // PaymentOrder has no `failureReason` column; we mark the metadata so
      // an audit can trace why this order was abandoned.
      const prevMeta = (existingPending.metadata as Record<string, unknown> | null) ?? {};
      await prisma.paymentOrder.update({
        where: { id: existingPending.id },
        data: {
          status: "REJECTED",
          metadata: { ...prevMeta, replacedBy: "stale_resume", replacedAt: new Date().toISOString() },
        },
      });
      log("info", "resume_payment_replaced_stale", {
        groupId: group.id,
        oldOrderId: existingPending.id,
        ageSeconds,
      });
    }
  }

  // Create new PaymentOrder
  const title = `Activación ${planType} - ${group.name}`;
  const order = await prisma.paymentOrder.create({
    data: {
      userId: dbUser.id,
      type: "GROUP_ACTIVATION",
      amount: quote.amountArs,
      description: title,
      metadata: {
        groupId: group.id,
        planType,
        estimatedPlayers: players,
        amountUsd: quote.amountUsd,
        arsRate: quote.arsRate,
        paymentResponsibility: planConfig.groupType === "ORGANIZATION" ? "COMPANY" : "ORGANIZER",
        ownerId: dbUser.id,
        resume: true,
      },
    },
  });

  const baseUrl = getBaseUrl();
  let preferenceId: string;
  let initPoint: string;
  try {
    const result = await createMPPreference({
      title,
      unitPrice: quote.amountArs,
      externalReference: order.id,
      backUrls: {
        success: `${baseUrl}/api/payments/callback?orderId=${order.id}`,
        failure: `${baseUrl}/api/payments/callback?orderId=${order.id}`,
        pending: `${baseUrl}/api/payments/callback?orderId=${order.id}`,
      },
      notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
    });
    preferenceId = result.preferenceId;
    initPoint = result.initPoint;
  } catch (err) {
    log("error", "resume_payment_mp_failed", { groupId: group.id, orderId: order.id, err: String(err) });
    return NextResponse.json(
      { error: "Error al crear preferencia de pago" },
      { status: 500 },
    );
  }

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { preferenceId },
  });

  // Move group back to PENDING_PAYMENT if it was in PAYMENT_FAILED or
  // PAYMENT_REVERSED. PENDING_PAYMENT stays PENDING_PAYMENT.
  if (group.status === "PAYMENT_FAILED" || group.status === "PAYMENT_REVERSED") {
    await prisma.group.update({
      where: { id: group.id },
      data: { status: "PENDING_PAYMENT", billingStatus: "RETRY" },
    });
  }

  log("info", "payment_created", {
    orderId: order.id,
    userId: dbUser.id,
    type: "GROUP_ACTIVATION",
    amount: quote.amountArs,
    preferenceId,
    resume: true,
    groupId: group.id,
  });

  return NextResponse.json({ initPoint, orderId: order.id });
}
