import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPPayment, validateWebhookSignature } from "@/lib/mercadopago";
import { creditCoins, debitCoins } from "@/lib/wallet";
import { WalletLotSource, type PlanType } from "@prisma/client";
import { log } from "@/lib/log";
import { validateProductionEnv } from "@/lib/env";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { PLANS, isPublicPlan, resolveLimits } from "@/lib/plans";

/**
 * Validate metadata of a GROUP_ACTIVATION order before activating the group.
 * Returns the validated payload or null (caller must reject the order).
 *
 * Hard rules:
 *   - groupId must be present and a string.
 *   - planType must be present, valid in PLANS, AND a public plan
 *     (rejects WHITE_LABEL even if someone tampers metadata).
 */
function validateGroupActivationMetadata(
  metadata: unknown,
): { groupId: string; planType: PlanType } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.groupId !== "string" || !m.groupId) return null;
  if (typeof m.planType !== "string") return null;
  if (!(m.planType in PLANS)) return null;
  const planType = m.planType as PlanType;
  if (!isPublicPlan(planType)) return null;
  return { groupId: m.groupId, planType };
}

type Decision =
  | { kind: "ignored"; reason: string }
  | { kind: "already_processed"; orderId: string }
  | { kind: "amount_mismatch"; orderId: string }
  | { kind: "rejected"; orderId: string }
  | { kind: "still_pending"; orderId: string }
  | { kind: "approved_pool"; orderId: string }
  | { kind: "refunded_pool"; orderId: string }
  | { kind: "approved_group_activation"; orderId: string }
  | { kind: "reversed_group_activation"; orderId: string }
  | {
      kind: "to_credit_coins";
      orderId: string;
      userId: string;
      packCoins: number | null;
    }
  | {
      kind: "to_revert_coins";
      orderId: string;
      userId: string;
      packCoins: number;
      finalStatus: "REFUNDED" | "CHARGEBACK";
    };

export async function POST(request: NextRequest) {
  validateProductionEnv();

  // Per-IP rate limit. MP uses ~12 IPs in their notification ranges so we
  // accept reasonable burst; only blocks abusive flooders.
  const ip = getClientIp(request);
  const rl = await rateLimit("webhookByIp", ip);
  if (!rl.ok) {
    log("warn", "webhook_rate_limited", { ip });
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const queryDataId = url.searchParams.get("data.id");

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const topic = (body.type || body.topic) as string | undefined;
  const data = body.data as { id?: string | number } | undefined;
  const resource = body.resource as string | undefined;
  const paymentId =
    data?.id?.toString() ||
    queryDataId ||
    (typeof resource === "string" ? resource.split("/").pop() ?? null : null);

  // Filter non-payment events early (merchant_order, etc)
  if (topic !== "payment") {
    return NextResponse.json({ ok: true, ignored: true, reason: "not_payment_topic" });
  }

  // Signature validation MUST happen before any DB work or MP API call
  const sig = request.headers.get("x-signature");
  const reqId = request.headers.get("x-request-id");
  if (!validateWebhookSignature(sig, reqId, paymentId)) {
    log("warn", "webhook_signature_invalid", { paymentId, hasSig: !!sig, hasReqId: !!reqId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "no_payment_id" });
  }

  log("info", "webhook_received", { paymentId });

  // Source of truth: never trust webhook body for payment data
  let mpPayment;
  try {
    mpPayment = await getMPPayment(paymentId);
  } catch (err) {
    log("error", "webhook_mp_fetch_failed", { paymentId, err: String(err) });
    return NextResponse.json({ error: "MP fetch failed" }, { status: 500 });
  }

  if (!mpPayment.externalReference) {
    log("info", "webhook_no_external_ref", { paymentId });
    return NextResponse.json({ ok: true, ignored: true, reason: "no_external_ref" });
  }

  // Phase 1: atomic decision. POOL_ENTRY finalizes here (tx-local upsert + status).
  // COIN_PACK does NOT mark APPROVED yet — it returns "to_credit_coins" so we credit
  // first (idempotent) then mark APPROVED outside the tx.
  let decision: Decision;
  try {
    decision = await prisma.$transaction(async (tx): Promise<Decision> => {
      const order = await tx.paymentOrder.findUnique({
        where: { id: mpPayment.externalReference! },
      });
      if (!order) {
        return { kind: "ignored", reason: "order_not_found" };
      }

      // ---- Path A: order was APPROVED — only refund/chargeback can move it.
      if (order.status === "APPROVED") {
        const isRefund = mpPayment.status === "refunded";
        const isChargeback = mpPayment.status === "charged_back";
        if (!isRefund && !isChargeback) {
          // Duplicate approved webhook or unrelated event — idempotent skip.
          return { kind: "already_processed", orderId: order.id };
        }
        const finalStatus: "REFUNDED" | "CHARGEBACK" = isRefund ? "REFUNDED" : "CHARGEBACK";

        if (order.type === "POOL_ENTRY") {
          // Mark contribution as refunded + flip order status, atomic.
          const meta = order.metadata as { groupId?: string } | null;
          if (meta?.groupId) {
            await tx.poolContribution.updateMany({
              where: { userId: order.userId, groupId: meta.groupId, paid: true },
              data: { paid: false, refundedAt: new Date() },
            });
          }
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: finalStatus, externalId: mpPayment.id },
          });
          return { kind: "refunded_pool", orderId: order.id };
        }
        if (order.type === "GROUP_ACTIVATION") {
          // Reverse premium activation: pause group + clear premium flags.
          const meta = order.metadata as { groupId?: string } | null;
          if (meta?.groupId) {
            const target = await tx.group.findUnique({ where: { id: meta.groupId } });
            if (target) {
              await tx.group.update({
                where: { id: meta.groupId },
                data: {
                  status: "PAYMENT_REVERSED",
                  isPremium: false,
                  billingStatus: finalStatus,
                },
              });
            } else {
              log("warn", "group_activation_reverse_target_missing", {
                orderId: order.id,
                groupId: meta.groupId,
              });
            }
          } else {
            log("warn", "group_activation_reverse_no_group_id", { orderId: order.id });
          }
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: finalStatus, externalId: mpPayment.id },
          });
          return { kind: "reversed_group_activation", orderId: order.id };
        }
        // COIN_PACK: defer wallet debit to phase 2 (uses its own tx + idempotency).
        const meta = order.metadata as { packCoins?: number } | null;
        return {
          kind: "to_revert_coins",
          orderId: order.id,
          userId: order.userId,
          packCoins: meta?.packCoins ?? 0,
          finalStatus,
        };
      }

      // ---- Path B: terminal states — fully idempotent.
      if (order.status === "REJECTED" || order.status === "REFUNDED" || order.status === "CHARGEBACK") {
        return { kind: "already_processed", orderId: order.id };
      }

      // ---- Path C: order is PENDING — original first-time processing.
      if (mpPayment.transactionAmount !== order.amount) {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: { status: "REJECTED", externalId: mpPayment.id },
        });
        return { kind: "amount_mismatch", orderId: order.id };
      }

      if (mpPayment.status === "approved") {
        if (order.type === "POOL_ENTRY") {
          const meta = order.metadata as { groupId?: string } | null;
          const groupId = meta?.groupId;
          if (groupId) {
            const group = await tx.group.findUnique({ where: { id: groupId } });
            if (group) {
              await tx.poolContribution.upsert({
                where: { userId_groupId: { userId: order.userId, groupId } },
                update: { paid: true, paidAt: new Date(), refundedAt: null },
                create: {
                  userId: order.userId,
                  groupId,
                  amount: group.entryFee,
                  paid: true,
                  paidAt: new Date(),
                },
              });
            }
          }
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: "APPROVED", externalId: mpPayment.id },
          });
          return { kind: "approved_pool", orderId: order.id };
        }

        if (order.type === "GROUP_ACTIVATION") {
          // Strict metadata validation: if invalid, REJECT the order so MP
          // sees a terminal state and the user gets a refundable record. Do
          // NOT mark APPROVED with a missing/invalid group — silent success
          // is worse than loud failure.
          const validated = validateGroupActivationMetadata(order.metadata);
          if (!validated) {
            await tx.paymentOrder.update({
              where: { id: order.id },
              data: { status: "REJECTED", externalId: mpPayment.id },
            });
            log("error", "group_activation_metadata_invalid", {
              paymentId: mpPayment.id,
              orderId: order.id,
              metadataKeys: Object.keys((order.metadata as object) ?? {}),
            });
            return { kind: "rejected", orderId: order.id };
          }

          // Verify the group still exists; if it was deleted between create
          // and webhook, also reject (don't approve a phantom).
          const targetGroup = await tx.group.findUnique({ where: { id: validated.groupId } });
          if (!targetGroup) {
            await tx.paymentOrder.update({
              where: { id: order.id },
              data: { status: "REJECTED", externalId: mpPayment.id },
            });
            log("error", "group_activation_target_missing", {
              orderId: order.id,
              groupId: validated.groupId,
            });
            return { kind: "rejected", orderId: order.id };
          }

          // Cross-validation: planType must be compatible with the group.type
          // recorded in DB. Defends against tampered metadata (e.g. someone
          // crafting a payment for COMMUNITY plan but pointing at a PERSONAL
          // group). Compatibility table is sourced from PLANS, not the metadata.
          if (PLANS[validated.planType].groupType !== targetGroup.type) {
            await tx.paymentOrder.update({
              where: { id: order.id },
              data: { status: "REJECTED", externalId: mpPayment.id },
            });
            log("error", "group_activation_plan_type_mismatch", {
              orderId: order.id,
              groupId: targetGroup.id,
              groupType: targetGroup.type,
              attemptedPlan: validated.planType,
              attemptedPlanGroupType: PLANS[validated.planType].groupType,
            });
            return { kind: "rejected", orderId: order.id };
          }

          await tx.group.update({
            where: { id: validated.groupId },
            data: {
              status: "ACTIVE",
              isPremium: true,
              planType: validated.planType,
              participantLimit: resolveLimits(validated.planType).maxPlayers,
              billingStatus: "PAID",
            },
          });
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: "APPROVED", externalId: mpPayment.id },
          });
          return { kind: "approved_group_activation", orderId: order.id };
        }

        // COIN_PACK: defer status update to phase 2
        const meta = order.metadata as { packCoins?: number } | null;
        return {
          kind: "to_credit_coins",
          orderId: order.id,
          userId: order.userId,
          packCoins: meta?.packCoins ?? null,
        };
      }

      // payments rejected: also mark the group as PAYMENT_FAILED if applicable
      if ((mpPayment.status === "rejected" || mpPayment.status === "cancelled") && order.type === "GROUP_ACTIVATION") {
        const meta = order.metadata as { groupId?: string } | null;
        if (meta?.groupId) {
          await tx.group.update({
            where: { id: meta.groupId },
            data: { status: "PAYMENT_FAILED", billingStatus: "FAILED" },
          });
        }
      }

      if (mpPayment.status === "rejected" || mpPayment.status === "cancelled") {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: { status: "REJECTED", externalId: mpPayment.id },
        });
        return { kind: "rejected", orderId: order.id };
      }

      // pending / in_process / authorized — leave as-is, MP will resend.
      return { kind: "still_pending", orderId: order.id };
    });
  } catch (err) {
    log("error", "webhook_failed", { stage: "tx", paymentId, err: String(err) });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  // Phase 2a: COIN_PACK refund/chargeback. Best-effort wallet debit.
  // If user already spent the coins, debit fails — we mark the order as
  // refunded (idempotency for retries) AND record the deficit in metadata
  // so ops can find unresolved cases via /api/admin/audit or DB query.
  if (decision.kind === "to_revert_coins") {
    let debitOk = false;
    let refundDeficit: number | null = null;
    if (decision.packCoins > 0) {
      try {
        await debitCoins({
          userId: decision.userId,
          amount: decision.packCoins,
          reason: `mp_refund_${decision.finalStatus.toLowerCase()}`,
          idempotencyKey: `mp_refund_${decision.orderId}`,
          metadata: { orderId: decision.orderId, paymentId: mpPayment.id },
        });
        debitOk = true;
      } catch (err) {
        refundDeficit = decision.packCoins;
        log("error", "webhook_refund_debit_failed", {
          paymentId,
          orderId: decision.orderId,
          userId: decision.userId,
          packCoins: decision.packCoins,
          finalStatus: decision.finalStatus,
          err: String(err),
        });
      }
    }
    try {
      // Merge existing metadata with refund result so ops can filter by
      // metadata.refundDeficit > 0 to find cases that need attention.
      const existing = await prisma.paymentOrder.findUnique({
        where: { id: decision.orderId },
        select: { metadata: true },
      });
      const prevMeta = (existing?.metadata as Record<string, unknown> | null) ?? {};
      const newMeta = {
        ...prevMeta,
        refundedAt: new Date().toISOString(),
        refundDebitOk: debitOk,
        refundDeficit,
        refundFinalStatus: decision.finalStatus,
      };
      await prisma.paymentOrder.update({
        where: { id: decision.orderId },
        data: {
          status: decision.finalStatus,
          externalId: mpPayment.id,
          metadata: newMeta,
        },
      });
    } catch (err) {
      log("error", "webhook_refund_finalize_failed", {
        paymentId,
        orderId: decision.orderId,
        err: String(err),
      });
      return NextResponse.json({ error: "Refund finalize failed" }, { status: 500 });
    }
    const evt = decision.finalStatus === "REFUNDED" ? "refund_processed" : "chargeback_processed";
    log("info", evt, {
      paymentId,
      orderId: decision.orderId,
      finalStatus: decision.finalStatus,
      debitOk,
    });
    return NextResponse.json({ ok: true, kind: "refunded_coins", debitOk });
  }

  // Phase 2: credit coins for COIN_PACK approved (idempotent by mp_<orderId>)
  if (decision.kind === "to_credit_coins") {
    if (decision.packCoins && decision.packCoins > 0) {
      try {
        await creditCoins({
          userId: decision.userId,
          amount: decision.packCoins,
          source: WalletLotSource.PURCHASE,
          reason: "coin_pack_purchase",
          idempotencyKey: `mp_${decision.orderId}`,
          metadata: { orderId: decision.orderId, paymentId: mpPayment.id },
        });
      } catch (err) {
        log("error", "webhook_credit_failed", {
          paymentId,
          orderId: decision.orderId,
          err: String(err),
        });
        return NextResponse.json({ error: "Credit failed" }, { status: 500 });
      }
    }

    // Mark APPROVED only AFTER coins were credited (or skipped because amount<=0).
    try {
      await prisma.paymentOrder.update({
        where: { id: decision.orderId },
        data: { status: "APPROVED", externalId: mpPayment.id },
      });
    } catch (err) {
      log("error", "webhook_order_finalize_failed", {
        paymentId,
        orderId: decision.orderId,
        err: String(err),
      });
      return NextResponse.json({ error: "Finalize failed" }, { status: 500 });
    }
  }

  // Add a refund event mirror for POOL_ENTRY (handled atomically inside tx)
  if (decision.kind === "refunded_pool") {
    log("info", "refund_processed", { paymentId, orderId: decision.orderId, type: "POOL_ENTRY" });
  }
  if (decision.kind === "approved_group_activation") {
    log("info", "group_activation_approved", { paymentId, orderId: decision.orderId });
  }
  if (decision.kind === "reversed_group_activation") {
    log("info", "group_activation_reversed", { paymentId, orderId: decision.orderId });
  }

  log("info", "webhook_processed", {
    paymentId,
    kind: decision.kind,
    orderId: "orderId" in decision ? decision.orderId : null,
  });
  return NextResponse.json({ ok: true, kind: decision.kind });
}
