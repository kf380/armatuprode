/**
 * Phase 2c — read player's premium memberships.
 *
 * Returns active memberships (validUntil > now) for the authenticated user.
 * UI uses this to render the PREMIUM badge + gate premium features.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const memberships = await prisma.premiumMembership.findMany({
    where: { userId: dbUser.id, validUntil: { gt: new Date() } },
    include: {
      tournament: { select: { id: true, name: true, endDate: true } },
    },
    orderBy: { paidAt: "desc" },
  });

  return NextResponse.json({
    isPremium: memberships.length > 0,
    memberships: memberships.map((m) => ({
      tournamentId: m.tournamentId,
      tournamentName: m.tournament.name,
      paidAt: m.paidAt.toISOString(),
      validUntil: m.validUntil.toISOString(),
      amountUsd: m.amountUsd,
    })),
  });
}
