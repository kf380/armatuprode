import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const boosters = await prisma.userBooster.findMany({
    where: { userId: dbUser.id },
  });

  const inventory: Record<string, number> = {};
  for (const b of boosters) {
    inventory[b.type] = b.quantity;
  }

  return NextResponse.json({ boosters: inventory, coins: dbUser.coins });
}
