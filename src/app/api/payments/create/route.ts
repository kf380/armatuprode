import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { createMPPreference } from "@/lib/mercadopago";

const COIN_PACKS: Record<string, { coins: number; price: number }> = {
  small: { coins: 500, price: 999 },
  medium: { coins: 1200, price: 1999 },
  large: { coins: 3000, price: 3999 },
};

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const { type, packId, groupId } = body as {
    type: "coin_pack" | "pool_entry";
    packId?: string;
    groupId?: string;
  };

  let title: string;
  let unitPrice: number;
  let metadata: Record<string, string | number>;

  if (type === "coin_pack") {
    if (!packId || !COIN_PACKS[packId]) {
      return NextResponse.json({ error: "Pack invalido" }, { status: 400 });
    }
    const pack = COIN_PACKS[packId];
    title = `${pack.coins} Coins - ArmatuProde`;
    unitPrice = pack.price;
    metadata = { packCoins: pack.coins, packId };
  } else if (type === "pool_entry") {
    if (!groupId) {
      return NextResponse.json({ error: "groupId requerido" }, { status: 400 });
    }
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !group.hasPool) {
      return NextResponse.json({ error: "Grupo sin pozo" }, { status: 400 });
    }

    // Check if already paid
    const existing = await prisma.poolContribution.findUnique({
      where: { userId_groupId: { userId: dbUser.id, groupId } },
    });
    if (existing?.paid) {
      return NextResponse.json({ error: "Ya pagaste la entrada" }, { status: 400 });
    }

    title = `Entrada pozo - ${group.name}`;
    unitPrice = group.entryFee;
    metadata = { groupId };
  } else {
    return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
  }

  // Create PaymentOrder in DB
  const order = await prisma.paymentOrder.create({
    data: {
      userId: dbUser.id,
      type: type === "coin_pack" ? "COIN_PACK" : "POOL_ENTRY",
      amount: unitPrice,
      description: title,
      metadata,
    },
  });

  const baseUrl = getBaseUrl();

  try {
    const { preferenceId, initPoint } = await createMPPreference({
      title,
      unitPrice,
      externalReference: order.id,
      backUrls: {
        success: `${baseUrl}/api/payments/callback?orderId=${order.id}`,
        failure: `${baseUrl}/api/payments/callback?orderId=${order.id}`,
        pending: `${baseUrl}/api/payments/callback?orderId=${order.id}`,
      },
      notificationUrl: `${baseUrl}/api/webhooks/mercadopago`,
    });

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { preferenceId },
    });

    return NextResponse.json({ initPoint, orderId: order.id });
  } catch (err) {
    console.error("Error creating MP preference:", err);
    return NextResponse.json({ error: "Error al crear preferencia de pago" }, { status: 500 });
  }
}
