import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { flags, canPlayersBeCharged } from "@/lib/flags";
import { limits } from "@/lib/limits";
import { PLANS, isPublicPlan, resolveLimits } from "@/lib/plans";
import type { GroupType, PlanType } from "@prisma/client";
import { log } from "@/lib/log";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  if (!dbUser) {
    return NextResponse.json({ groups: [] });
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId: dbUser.id },
    include: {
      group: {
        include: {
          tournament: { select: { name: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  const groups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    emoji: m.group.emoji,
    tournament: m.group.tournament.name,
    memberCount: m.group._count.members,
    role: m.role,
    hasPool: m.group.hasPool,
    entryFee: m.group.entryFee,
    currency: m.group.currency,
    inviteCode: m.group.inviteCode,
    createdById: m.group.createdById,
    // B2B
    type: m.group.type,
    planType: m.group.planType,
    status: m.group.status,
    isPremium: m.group.isPremium,
    participantLimit: m.group.participantLimit,
    prizeType: m.group.prizeType,
    prizeDescription: m.group.prizeDescription,
    rulesDescription: m.group.rulesDescription,
    publicJoinEnabled: m.group.publicJoinEnabled,
    brandingConfig: m.group.brandingConfig,
    billingStatus: m.group.billingStatus,
    paymentResponsibility: m.group.paymentResponsibility,
    organizationId: m.group.organizationId,
  }));

  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const {
    name,
    emoji,
    tournamentId,
    // legacy cash-pool path (gated by ENABLE_REAL_MONEY_POOLS)
    hasPool,
    entryFee,
    currency,
    // B2B fields
    type: rawType,
    planType: rawPlan,
    organizationId,
    prizeType: rawPrize,
    prizeDescription,
    rulesDescription,
    publicJoinEnabled,
    brandingConfig,
    // Phase 2: Manual Pool (gated by ENABLE_MANUAL_POOLS)
    moneyMode: rawMoneyMode,
    declaredPoolEntry: rawDeclaredPoolEntry,
  } = body;

  if (!name || !tournamentId) {
    return NextResponse.json({ error: "Nombre y torneo son requeridos" }, { status: 400 });
  }

  // ---- B2B path: resolve type + plan with safe defaults ----
  const groupType: GroupType = rawType === "ORGANIZATION" ? "ORGANIZATION" : "PERSONAL";
  const planType: PlanType = (rawPlan && rawPlan in PLANS ? rawPlan : "FREE") as PlanType;

  // Hard gate: WHITE_LABEL is internal-only, never accept from public requests.
  if (!isPublicPlan(planType)) {
    return NextResponse.json({ error: "Plan no disponible" }, { status: 403 });
  }

  // Cross-validate: plan must match group type (e.g. COMMUNITY requires ORGANIZATION).
  if (PLANS[planType].groupType !== groupType) {
    return NextResponse.json(
      { error: `El plan ${planType} no es compatible con grupos ${groupType}` },
      { status: 400 },
    );
  }

  // Feature flag gates per group type.
  if (groupType === "PERSONAL" && !flags.enablePersonalGroups()) {
    return NextResponse.json({ error: "Grupos personales no disponibles" }, { status: 403 });
  }
  if (groupType === "ORGANIZATION" && !flags.enableB2bOrganizers()) {
    return NextResponse.json({ error: "Prodes de organización no disponibles" }, { status: 403 });
  }
  if (groupType === "ORGANIZATION" && planType !== "FREE" && !flags.enableOrganizationPlans()) {
    return NextResponse.json({ error: "Planes de organización no disponibles" }, { status: 403 });
  }

  // Validate organizationId ownership/membership when provided.
  if (organizationId) {
    if (groupType !== "ORGANIZATION") {
      return NextResponse.json(
        { error: "organizationId solo es válido para grupos de organización" },
        { status: 400 },
      );
    }
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
    }
    const isOwner = org.ownerId === dbUser.id;
    const memberRow = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: dbUser.id } },
    });
    const isAdmin = memberRow?.role === "OWNER" || memberRow?.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "No tenés permiso para crear prodes en esta organización" },
        { status: 403 },
      );
    }
  }

  // ---- Legacy cash-pool path (POOL_ENTRY) — strictly gated ----
  // Triple gate (canPlayersBeCharged): require enableRealMoneyPools +
  // enablePlayerPayments + legalRealMoneyPoolsApproved. Defense-in-depth:
  // a single flag flipped by mistake must not open player charging.
  if (hasPool) {
    if (!canPlayersBeCharged()) {
      return NextResponse.json(
        { error: "Los pozos con dinero real no están habilitados" },
        { status: 403 },
      );
    }
    if (!Number.isInteger(entryFee) || entryFee <= 0) {
      return NextResponse.json({ error: "Entrada de pozo inválida" }, { status: 400 });
    }
    if (entryFee > limits.maxEntryFee()) {
      return NextResponse.json(
        { error: `El monto de entrada excede el límite (${limits.maxEntryFee()})` },
        { status: 403 },
      );
    }
    const activePaidGroups = await prisma.group.count({ where: { hasPool: true } });
    if (activePaidGroups >= limits.maxActivePaidGroups()) {
      return NextResponse.json(
        { error: "Se alcanzó el cupo de pozos pagos activos. Probá más tarde." },
        { status: 403 },
      );
    }
  }

  // ---- Phase 2: resolve moneyMode + declaredPoolEntry (gated) ----
  // Only accept MANUAL_POOL if the flag is on AND the client opted in. AUTOMATED_POOL
  // is rejected here even if it slips through the enum — it requires legal sign-off.
  let moneyMode: "NONE" | "MANUAL_POOL" = "NONE";
  let declaredPoolEntry: number | null = null;
  if (flags.enableManualPools() && rawMoneyMode === "MANUAL_POOL") {
    moneyMode = "MANUAL_POOL";
    if (Number.isInteger(rawDeclaredPoolEntry) && rawDeclaredPoolEntry > 0) {
      declaredPoolEntry = rawDeclaredPoolEntry as number;
    }
  }
  if (rawMoneyMode === "AUTOMATED_POOL") {
    return NextResponse.json(
      { error: "Modo no disponible (requiere aprobación legal)." },
      { status: 403 },
    );
  }

  // ---- Determine status based on plan ----
  // FREE → ACTIVE immediately. Premium plans → PENDING_PAYMENT until webhook.
  const isFreePlan = planType === "FREE";
  const initialStatus = isFreePlan ? "ACTIVE" : "PENDING_PAYMENT";
  const participantLimit = resolveLimits(planType).maxPlayers;
  const paymentResponsibility = isFreePlan
    ? "NONE"
    : groupType === "ORGANIZATION"
      ? "COMPANY"
      : "ORGANIZER";

  const group = await prisma.group.create({
    data: {
      name,
      emoji: emoji || "🏆",
      tournamentId,
      createdById: dbUser.id,
      hasPool: hasPool || false,
      entryFee: hasPool ? entryFee : 0,
      currency: currency || "ARS",
      // B2B fields
      type: groupType,
      organizationId: organizationId || null,
      planType,
      status: initialStatus,
      isPremium: !isFreePlan,
      participantLimit,
      prizeType: rawPrize && ["NONE", "MANUAL_FIXED", "SPONSOR"].includes(rawPrize) ? rawPrize : "NONE",
      prizeDescription: prizeDescription ?? null,
      rulesDescription: rulesDescription ?? null,
      publicJoinEnabled: !!publicJoinEnabled,
      brandingConfig: brandingConfig ?? undefined,
      paymentResponsibility,
      // Phase 2: Manual Pool
      moneyMode,
      declaredPoolEntry,
      declaredPoolUpdatedAt: declaredPoolEntry !== null ? new Date() : null,
      members: {
        create: {
          userId: dbUser.id,
          role: "ADMIN",
        },
      },
    },
  });

  log("info", "group_created", {
    groupId: group.id,
    type: groupType,
    planType,
    status: initialStatus,
    isPremium: !isFreePlan,
    createdById: dbUser.id,
  });

  return NextResponse.json({ group }, { status: 201 });
}
