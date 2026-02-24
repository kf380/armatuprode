import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { debitCoins } from "@/lib/wallet";

const BOOSTER_PRICES: Record<string, number> = {
  x2: 100,
  shield: 150,
  second_chance: 200,
};

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
  const { type } = body;

  const price = BOOSTER_PRICES[type];
  if (!price) {
    return NextResponse.json({ error: "Booster invalido" }, { status: 400 });
  }

  if (dbUser.coins < price) {
    return NextResponse.json({ error: "Coins insuficientes" }, { status: 400 });
  }

  try {
    await debitCoins({
      userId: dbUser.id,
      amount: price,
      reason: `buy_booster_${type}`,
    });
  } catch {
    return NextResponse.json({ error: "Coins insuficientes" }, { status: 400 });
  }

  // Add or increment booster
  await prisma.userBooster.upsert({
    where: { userId_type: { userId: dbUser.id, type } },
    update: { quantity: { increment: 1 } },
    create: { userId: dbUser.id, type, quantity: 1 },
  });

  return NextResponse.json({
    ok: true,
    coins: dbUser.coins - price,
  });
}
