import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { createMPPreference } from "@/lib/mercadopago";
import { rateLimit } from "@/lib/ratelimit";
import { flags, canPlayersBeCharged } from "@/lib/flags";
import { limits } from "@/lib/limits";
import { log } from "@/lib/log";
import { PLANS, isPublicPlan, priceFor, priceForPool } from "@/lib/plans";
import type { PaymentType, PlanType } from "@prisma/client";

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

  const rl = await rateLimit("paymentsCreate", user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos de pago, esperá un momento" },
      { status: 429 },
    );
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const { type, packId, groupId, planType: rawPlan, estimatedPlayers, tournamentId } = body as {
    type: "coin_pack" | "pool_entry" | "group_activation";
    packId?: string;
    groupId?: string;
    planType?: PlanType;
    estimatedPlayers?: number;
    tournamentId?: string;
  };

  let title: string;
  let unitPrice: number;
  let metadata: Record<string, string | number>;
  let paymentType: PaymentType;

  if (type === "coin_pack") {
    if (!flags.enableCoinShop()) {
      return NextResponse.json(
        { error: "La tienda de coins no esta disponible en este momento" },
        { status: 403 },
      );
    }
    if (!packId || !COIN_PACKS[packId]) {
      return NextResponse.json({ error: "Pack invalido" }, { status: 400 });
    }
    const pack = COIN_PACKS[packId];
    title = `${pack.coins} Coins - ArmatuProde`;
    unitPrice = pack.price;
    metadata = { packCoins: pack.coins, packId };
    paymentType = "COIN_PACK";
  } else if (type === "pool_entry") {
    if (!canPlayersBeCharged()) {
      return NextResponse.json(
        { error: "Los pozos con dinero real no estan habilitados todavia" },
        { status: 403 },
      );
    }
    if (!groupId) {
      return NextResponse.json({ error: "groupId requerido" }, { status: 400 });
    }
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || !group.hasPool) {
      return NextResponse.json({ error: "Grupo sin pozo" }, { status: 400 });
    }

    // Operational caps for controlled launch
    if (group.entryFee > limits.maxEntryFee()) {
      return NextResponse.json(
        { error: `El monto de entrada excede el límite operativo (${limits.maxEntryFee()})` },
        { status: 403 },
      );
    }
    const memberCount = await prisma.groupMember.count({ where: { groupId: group.id } });
    if (memberCount > limits.maxPoolParticipants()) {
      return NextResponse.json(
        { error: `Pozo lleno: máximo ${limits.maxPoolParticipants()} participantes` },
        { status: 403 },
      );
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
    paymentType = "POOL_ENTRY";
  } else if (type === "group_activation") {
    // ---- B2B path: organizer pays to activate a premium group ----
    if (!groupId) {
      return NextResponse.json({ error: "groupId requerido" }, { status: 400 });
    }
    if (!rawPlan || !(rawPlan in PLANS)) {
      return NextResponse.json({ error: "planType requerido" }, { status: 400 });
    }
    if (!isPublicPlan(rawPlan)) {
      return NextResponse.json({ error: "Plan no disponible" }, { status: 403 });
    }
    if (rawPlan === "FREE") {
      return NextResponse.json(
        { error: "El plan FREE no requiere pago. Activá directamente vía /api/groups/[id]/activate." },
        { status: 400 },
      );
    }

    // Feature flag gates
    const planConfig = PLANS[rawPlan];
    if (planConfig.groupType === "PERSONAL" && !flags.enablePersonalGroups()) {
      return NextResponse.json({ error: "Grupos personales no disponibles" }, { status: 403 });
    }
    if (planConfig.groupType === "ORGANIZATION" && !flags.enableOrganizationPlans()) {
      return NextResponse.json({ error: "Planes de organización no disponibles" }, { status: 403 });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
    }
    if (group.createdById !== dbUser.id) {
      return NextResponse.json(
        { error: "Solo el creador puede activar este prode" },
        { status: 403 },
      );
    }
    if (group.status === "ACTIVE" && group.isPremium && group.planType === rawPlan) {
      return NextResponse.json(
        { error: "El prode ya está activo con este plan" },
        { status: 400 },
      );
    }

    const players = Number.isInteger(estimatedPlayers) && (estimatedPlayers ?? 0) > 0
      ? (estimatedPlayers as number)
      : planConfig.minimumUsd > 0
        ? Math.ceil(planConfig.minimumUsd / Math.max(1, planConfig.pricePerPlayerUsd))
        : 0;

    // Phase 2: pricing branch by MoneyMode.
    //   MANUAL_POOL → priceForPool(declaredPoolEntry × estimatedPlayers)
    //   NONE        → priceFor(plan, players)
    let amountUsd: number;
    let amountArs: number;
    let arsRate: number;
    let pricingModel: "PLAN_FIXED" | "POOL_DECLARED" = "PLAN_FIXED";
    let declaredPoolTotal: number | null = null;

    if (
      flags.enableManualPools() &&
      group.moneyMode === "MANUAL_POOL" &&
      group.declaredPoolEntry &&
      group.declaredPoolEntry > 0
    ) {
      declaredPoolTotal = group.declaredPoolEntry * Math.max(players, 1);
      const poolQuote = priceForPool(declaredPoolTotal);
      amountUsd = poolQuote.amountUsd;
      amountArs = poolQuote.amountArs;
      arsRate = poolQuote.arsRate;
      pricingModel = "POOL_DECLARED";
    } else {
      const quote = priceFor(rawPlan, players);
      if (quote.amountArs <= 0) {
        return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
      }
      amountUsd = quote.amountUsd;
      amountArs = quote.amountArs;
      arsRate = quote.arsRate;
    }

    title = `Activación ${rawPlan} - ${group.name}`;
    unitPrice = amountArs;
    metadata = {
      groupId,
      planType: rawPlan,
      estimatedPlayers: players,
      amountUsd,
      arsRate,
      paymentResponsibility: planConfig.groupType === "ORGANIZATION" ? "COMPANY" : "ORGANIZER",
      ownerId: dbUser.id,
      pricingModel,
      ...(declaredPoolTotal !== null ? { declaredPoolTotal } : {}),
    };
    paymentType = "GROUP_ACTIVATION";
  } else {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  // Create PaymentOrder in DB
  const order = await prisma.paymentOrder.create({
    data: {
      userId: dbUser.id,
      type: paymentType,
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

    log("info", "payment_created", {
      orderId: order.id,
      userId: dbUser.id,
      type: order.type,
      amount: unitPrice,
      preferenceId,
    });
    return NextResponse.json({ initPoint, orderId: order.id });
  } catch (err) {
    console.error("Error creating MP preference:", err);
    return NextResponse.json({ error: "Error al crear preferencia de pago" }, { status: 500 });
  }
}
