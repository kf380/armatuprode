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

// POST removed: pool entry must come exclusively from MP webhook on APPROVED PaymentOrder.
// Use POST /api/payments/create with { type: "pool_entry", groupId } to start the flow.
export async function POST() {
  return NextResponse.json(
    { error: "Endpoint deshabilitado. Pagá con MercadoPago desde /api/payments/create." },
    { status: 410 },
  );
}
