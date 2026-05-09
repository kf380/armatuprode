import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { canEditGroup, canResumePayment, canViewBilling } from "@/lib/group-policy";
import { log } from "@/lib/log";
import { flags } from "@/lib/flags";
import type { OrgMemberRole, PrizeType, MoneyMode } from "@prisma/client";

const VALID_PRIZE_TYPES: PrizeType[] = ["NONE", "MANUAL_FIXED", "SPONSOR"];

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
    include: {
      tournament: { select: { id: true, name: true, type: true } },
      organization: { select: { id: true, name: true, logoUrl: true, slug: true } },
      members: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true, country: true, xp: true },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  // Verify user is a member of this group
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser || !group.members.some((m) => m.userId === dbUser.id)) {
    return NextResponse.json({ error: "No sos miembro de este grupo" }, { status: 403 });
  }

  const memberIds = group.members.map((m) => m.userId);
  const predictions = await prisma.prediction.findMany({
    where: {
      userId: { in: memberIds },
      match: { tournamentId: group.tournamentId },
    },
    select: { userId: true, points: true },
  });

  const pointsByUser: Record<string, number> = {};
  for (const p of predictions) {
    pointsByUser[p.userId] = (pointsByUser[p.userId] || 0) + p.points;
  }

  const ranking = group.members
    .map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      avatar: m.user.avatar,
      country: m.user.country,
      points: pointsByUser[m.userId] || 0,
      role: m.role,
    }))
    .sort((a, b) => b.points - a.points);

  // Resolve org role + member role + permissions for the requesting user.
  let orgRole: OrgMemberRole | null = null;
  if (group.organizationId) {
    const orgM = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: group.organizationId, userId: dbUser.id } },
    });
    orgRole = orgM?.role ?? null;
  }
  const myMember = group.members.find((m) => m.userId === dbUser.id);
  const permissions = {
    canEdit: canEditGroup({ group, userId: dbUser.id, orgRole }).ok,
    canViewBilling: canViewBilling({ group, userId: dbUser.id, orgRole }).ok,
    canResumePayment: canResumePayment({ group, userId: dbUser.id }).ok,
  };

  // Materialize members[] for organizer dashboard (already loaded above).
  const members = group.members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    avatar: m.user.avatar,
    country: m.user.country,
    xp: m.user.xp,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  }));

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      tournament: group.tournament,
      memberCount: group._count.members,
      inviteCode: group.inviteCode,
      // B2B
      type: group.type,
      planType: group.planType,
      status: group.status,
      isPremium: group.isPremium,
      participantLimit: group.participantLimit,
      prizeType: group.prizeType,
      prizeDescription: group.prizeDescription,
      rulesDescription: group.rulesDescription,
      publicJoinEnabled: group.publicJoinEnabled,
      brandingConfig: group.brandingConfig,
      billingStatus: group.billingStatus,
      paymentResponsibility: group.paymentResponsibility,
      organization: group.organization,
      createdById: group.createdById,
      // Legacy
      hasPool: group.hasPool,
      entryFee: group.entryFee,
      currency: group.currency,
      // Phase 2: Manual Pool
      moneyMode: group.moneyMode,
      declaredPoolEntry: group.declaredPoolEntry,
      declaredPoolCurrency: group.declaredPoolCurrency,
      declaredPoolUpdatedAt: group.declaredPoolUpdatedAt?.toISOString() ?? null,
    },
    ranking,
    members,
    myRole: myMember?.role ?? null,
    myOrgRole: orgRole,
    permissions,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Prode no encontrado" }, { status: 404 });

  // Resolve user's org role (if group is org-bound) so canEditGroup can grant
  // OWNER/ADMIN editing rights.
  let orgRole: OrgMemberRole | null = null;
  if (group.organizationId) {
    const m = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: group.organizationId, userId: dbUser.id } },
    });
    orgRole = m?.role ?? null;
  }
  const policy = canEditGroup({ group, userId: dbUser.id, orgRole });
  if (!policy.ok) {
    return NextResponse.json({ error: policy.reason }, { status: policy.status });
  }

  // Block edits in terminal/dead states.
  if (group.status === "CANCELLED" || group.status === "FINISHED") {
    return NextResponse.json(
      { error: `No se puede editar un prode ${group.status === "FINISHED" ? "finalizado" : "cancelado"}` },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    prizeType: rawPrizeType,
    prizeDescription,
    rulesDescription,
    publicJoinEnabled,
    brandingConfig,
    // Phase 2: Manual Pool (gated)
    moneyMode: rawMoneyMode,
    declaredPoolEntry: rawDeclaredPoolEntry,
  } = body as {
    prizeType?: PrizeType;
    prizeDescription?: string | null;
    rulesDescription?: string | null;
    publicJoinEnabled?: boolean;
    brandingConfig?: Record<string, unknown> | null;
    moneyMode?: MoneyMode;
    declaredPoolEntry?: number | null;
  };

  // Build patch object selectively. Reject any field not in the allowlist.
  // (We never accept hasPool, entryFee, paymentResponsibility, planType, type,
  // status, isPremium, participantLimit, billingStatus from the client — those
  // are policy-driven, not user-editable here.)
  const data: Record<string, unknown> = {};

  // Prize: descripcion + tipo van juntos. Si description queda vacia, forzar
  // prizeType=NONE para mantener consistencia (no podes tener "MANUAL_FIXED"
  // sin descripcion).
  let nextPrizeDescription: string | null | undefined;
  if (prizeDescription !== undefined) {
    nextPrizeDescription = prizeDescription === null ? null : prizeDescription.trim() || null;
    data.prizeDescription = nextPrizeDescription;
  }
  if (rawPrizeType !== undefined) {
    if (!VALID_PRIZE_TYPES.includes(rawPrizeType)) {
      return NextResponse.json({ error: "prizeType invalido" }, { status: 400 });
    }
    data.prizeType = rawPrizeType;
  }
  // Auto-coerce: si la descripcion quedo vacia y prizeType no fue forzado a NONE,
  // bajamos a NONE para evitar estado raro "MANUAL_FIXED sin texto".
  const finalDescription =
    nextPrizeDescription !== undefined ? nextPrizeDescription : group.prizeDescription;
  const finalType = (data.prizeType as PrizeType | undefined) ?? group.prizeType;
  if (finalType !== "NONE" && !finalDescription) {
    data.prizeType = "NONE";
  }

  if (rulesDescription !== undefined) {
    data.rulesDescription = rulesDescription === null ? null : rulesDescription.trim() || null;
  }
  if (typeof publicJoinEnabled === "boolean") {
    data.publicJoinEnabled = publicJoinEnabled;
  }
  if (brandingConfig !== undefined) {
    // Only allow plain JSON objects (no functions, no prototype pollution risk).
    if (brandingConfig === null || typeof brandingConfig === "object") {
      data.brandingConfig = brandingConfig === null ? null : (brandingConfig as object);
    } else {
      return NextResponse.json({ error: "brandingConfig invalido" }, { status: 400 });
    }
  }

  // Phase 2: Manual Pool — only accept changes if flag is on. AUTOMATED_POOL
  // is hard-rejected here even if it sneaks through enum validation.
  if (rawMoneyMode === "AUTOMATED_POOL") {
    return NextResponse.json(
      { error: "Modo no disponible (requiere aprobación legal)." },
      { status: 403 },
    );
  }
  if (flags.enableManualPools()) {
    if (rawMoneyMode === "NONE" || rawMoneyMode === "MANUAL_POOL") {
      data.moneyMode = rawMoneyMode;
      // When switching to NONE, clear declared pool fields. When switching to
      // MANUAL_POOL, require an entry value to be present (current or new).
      if (rawMoneyMode === "NONE") {
        data.declaredPoolEntry = null;
        data.declaredPoolUpdatedAt = null;
      }
    }
    if (rawDeclaredPoolEntry !== undefined) {
      if (rawDeclaredPoolEntry === null) {
        data.declaredPoolEntry = null;
        data.declaredPoolUpdatedAt = null;
      } else if (Number.isInteger(rawDeclaredPoolEntry) && rawDeclaredPoolEntry > 0) {
        data.declaredPoolEntry = rawDeclaredPoolEntry;
        data.declaredPoolUpdatedAt = new Date();
      } else {
        return NextResponse.json({ error: "declaredPoolEntry inválido" }, { status: 400 });
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const updated = await prisma.group.update({ where: { id }, data });
  log("info", "group_config_updated", {
    groupId: id,
    userId: dbUser.id,
    fields: Object.keys(data),
  });

  return NextResponse.json({ group: updated });
}
