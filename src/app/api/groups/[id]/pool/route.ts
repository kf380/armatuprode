import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    select: {
      hasPool: true,
      entryFee: true,
      currency: true,
      poolDistribution: true,
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  const contributions = await prisma.poolContribution.findMany({
    where: { groupId: id },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  const totalCollected = contributions
    .filter((c) => c.paid)
    .reduce((sum, c) => sum + c.amount, 0);

  return NextResponse.json({
    pool: {
      hasPool: group.hasPool,
      entryFee: group.entryFee,
      currency: group.currency,
      distribution: group.poolDistribution,
      totalCollected,
      contributions,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
  });

  if (!group || !group.hasPool) {
    return NextResponse.json({ error: "Este grupo no tiene pozo" }, { status: 400 });
  }

  const contribution = await prisma.poolContribution.upsert({
    where: {
      userId_groupId: {
        userId: dbUser.id,
        groupId: id,
      },
    },
    update: { paid: true, paidAt: new Date() },
    create: {
      userId: dbUser.id,
      groupId: id,
      amount: group.entryFee,
      paid: true,
      paidAt: new Date(),
    },
  });

  return NextResponse.json({ contribution });
}
