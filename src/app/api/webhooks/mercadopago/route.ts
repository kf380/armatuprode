import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMPPayment } from "@/lib/mercadopago";
import { creditCoins } from "@/lib/wallet";
import { WalletLotSource } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // MP sends different notification types; we only care about payments
    const topic = body.type || body.topic;
    if (topic !== "payment") {
      return NextResponse.json({ ok: true });
    }

    // Extract payment ID from the notification
    const paymentId =
      body.data?.id?.toString() ||
      (typeof body.resource === "string"
        ? body.resource.split("/").pop()
        : null);

    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    // Fetch full payment details from MP
    const mpPayment = await getMPPayment(paymentId);

    if (!mpPayment.externalReference) {
      return NextResponse.json({ ok: true });
    }

    // Find our order by external_reference (= order ID)
    const order = await prisma.paymentOrder.findUnique({
      where: { id: mpPayment.externalReference },
    });

    if (!order) {
      console.error("Webhook: order not found for ref:", mpPayment.externalReference);
      return NextResponse.json({ ok: true });
    }

    // Idempotency: check if already processed
    if (order.status !== "PENDING") {
      return NextResponse.json({ ok: true });
    }

    // Validate amount matches
    if (mpPayment.transactionAmount !== order.amount) {
      console.error(
        `Webhook: amount mismatch. Expected ${order.amount}, got ${mpPayment.transactionAmount}. Order: ${order.id}`
      );
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "REJECTED", externalId: mpPayment.id },
      });
      return NextResponse.json({ ok: true });
    }

    if (mpPayment.status === "approved") {
      // Process based on order type
      if (order.type === "COIN_PACK") {
        const meta = order.metadata as { packCoins?: number } | null;
        const packCoins = meta?.packCoins;
        if (packCoins && packCoins > 0) {
          await creditCoins({
            userId: order.userId,
            amount: packCoins,
            source: WalletLotSource.PURCHASE,
            reason: "coin_pack_purchase",
            idempotencyKey: `mp_${order.id}`,
            metadata: { orderId: order.id, paymentId: mpPayment.id },
          });
        }
      } else if (order.type === "POOL_ENTRY") {
        const meta = order.metadata as { groupId?: string } | null;
        const groupId = meta?.groupId;
        if (groupId) {
          const group = await prisma.group.findUnique({ where: { id: groupId } });
          if (group) {
            await prisma.poolContribution.upsert({
              where: {
                userId_groupId: { userId: order.userId, groupId },
              },
              update: { paid: true, paidAt: new Date() },
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
      }

      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "APPROVED", externalId: mpPayment.id },
      });
    } else if (
      mpPayment.status === "rejected" ||
      mpPayment.status === "cancelled"
    ) {
      await prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: "REJECTED", externalId: mpPayment.id },
      });
    }
    // For other statuses (in_process, pending), keep PENDING

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    // Always return 200 so MP doesn't keep retrying on our errors
    return NextResponse.json({ ok: true });
  }
}
