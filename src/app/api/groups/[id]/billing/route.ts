import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { canViewBilling } from "@/lib/group-policy";
import { PLANS, priceFor, priceForPool } from "@/lib/plans";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  // If org-bound, look up role
  let orgRole: "OWNER" | "ADMIN" | "PLAYER" | null = null;
  if (group.organizationId) {
    const m = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: group.organizationId, userId: dbUser.id } },
    });
    orgRole = m?.role ?? null;
  }

  const policy = canViewBilling({
    group,
    userId: dbUser.id,
    orgRole,
  });
  if (!policy.ok) {
    return NextResponse.json({ error: policy.reason }, { status: policy.status });
  }

  // Latest GROUP_ACTIVATION orders for this group (ordered desc)
  const orders = await prisma.paymentOrder.findMany({
    where: {
      type: "GROUP_ACTIVATION",
      // metadata.groupId match — filter in memory since it's JSON
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const groupOrders = orders.filter((o) => {
    const meta = o.metadata as { groupId?: string } | null;
    return meta?.groupId === id;
  });

  const planConfig = PLANS[group.planType];
  const memberCount = group._count.members;

  // Phase 2: pricing branch by MoneyMode.
  //   NONE        → existing flat/per-player formula
  //   MANUAL_POOL → priceForPool(declaredPoolEntry × estimated players)
  let quote: ReturnType<typeof priceFor> | null = null;
  let poolQuote: ReturnType<typeof priceForPool> | null = null;
  if (group.moneyMode === "MANUAL_POOL" && group.declaredPoolEntry) {
    const declaredTotal = group.declaredPoolEntry * Math.max(memberCount, 1);
    poolQuote = priceForPool(declaredTotal);
  } else {
    quote = priceFor(group.planType, memberCount);
  }

  return NextResponse.json({
    billing: {
      groupId: id,
      planType: group.planType,
      planConfig: {
        maxPlayers: planConfig.maxPlayers,
        flatUsd: planConfig.flatUsd,
        pricePerPlayerUsd: planConfig.pricePerPlayerUsd,
        minimumUsd: planConfig.minimumUsd,
        analytics: planConfig.analytics,
      },
      status: group.status,
      isPremium: group.isPremium,
      paymentResponsibility: group.paymentResponsibility,
      billingStatus: group.billingStatus,
      participantLimit: group.participantLimit,
      currentPlayers: memberCount,
      // MoneyMode-aware quote: exactly one of these two will be non-null.
      moneyMode: group.moneyMode,
      declaredPoolEntry: group.declaredPoolEntry,
      quoteForCurrentSize: quote,
      poolQuote,
      orders: groupOrders.map((o) => ({
        id: o.id,
        status: o.status,
        amount: o.amount,
        description: o.description,
        externalId: o.externalId,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    },
  });
}
