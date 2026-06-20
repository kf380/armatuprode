import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { flags, canPlayersBeCharged } from "@/lib/flags";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

// Public endpoint (no auth required) — returns basic group info by invite code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code) {
    return NextResponse.json({ error: "Codigo requerido" }, { status: 400 });
  }

  const rl = await rateLimit("inviteLookup", getClientIp(request));
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas búsquedas, esperá un momento" }, { status: 429 });
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: {
      tournament: { select: { name: true } },
      organization: { select: { name: true, logoUrl: true, slug: true } },
      _count: { select: { members: true } },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  // Get creator name (the original creator, not just any ADMIN)
  const creator = await prisma.user.findUnique({
    where: { id: group.createdById },
    select: { name: true },
  });

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      tournament: group.tournament.name,
      memberCount: group._count.members,
      inviteCode: group.inviteCode,
      createdBy: creator?.name || "Admin",
      // B2B fields
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
      organization: group.organization
        ? {
            name: group.organization.name,
            logoUrl: group.organization.logoUrl,
            slug: group.organization.slug,
          }
        : null,
      // Legacy cash-pool fields. Only exposed when the triple gate is open
      // (canPlayersBeCharged). With any of the three flags off the payload is
      // neutralized so the UI cannot render pool entry copy.
      ...(canPlayersBeCharged()
        ? {
            hasPool: group.hasPool,
            entryFee: group.entryFee,
            currency: group.currency,
          }
        : {
            hasPool: false,
            entryFee: 0,
            currency: group.currency,
          }),
      // Phase 2: Manual Pool. Only exposed when ENABLE_MANUAL_POOLS=true AND
      // the group is actually in MANUAL_POOL mode. Anything else is null so
      // JoinGroupScreen cannot render a "pozo declarado" block by accident.
      ...(flags.enableManualPools() && group.moneyMode === "MANUAL_POOL"
        ? {
            moneyMode: "MANUAL_POOL" as const,
            declaredPoolEntry: group.declaredPoolEntry,
            declaredPoolCurrency: group.declaredPoolCurrency,
          }
        : {
            moneyMode: "NONE" as const,
            declaredPoolEntry: null,
            declaredPoolCurrency: null,
          }),
    },
  });
}
