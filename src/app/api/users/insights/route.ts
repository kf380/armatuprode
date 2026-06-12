import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

/**
 * Premium-gated insights. Returns extended performance stats:
 *   - bestPrediction:    user's highest-scoring pick (exacto highlighted)
 *   - longestStreak:     longest consecutive correct predictions ever
 *   - precisionByPhase:  precision per match phase
 *   - daysActive:        days since signup
 *
 * Gated by checking the user has an active PremiumMembership at request time
 * (not just the flag — actual entitlement). Free users get 403 with a hint
 * payload so the UI can show the upsell.
 */
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const tournament = await prisma.tournament.findFirst({ where: { active: true } });
  if (!tournament) return NextResponse.json({ insights: null });

  const active = await prisma.premiumMembership.findFirst({
    where: {
      userId: dbUser.id,
      tournamentId: tournament.id,
      validUntil: { gt: new Date() },
    },
  });
  if (!active) {
    return NextResponse.json({ error: "Insights es feature Premium", upsell: true }, { status: 403 });
  }

  const preds = await prisma.prediction.findMany({
    where: { userId: dbUser.id, match: { tournamentId: tournament.id, status: "FINISHED" } },
    select: {
      scoreA: true,
      scoreB: true,
      points: true,
      match: { select: { teamAName: true, teamBName: true, teamAFlag: true, teamBFlag: true, scoreA: true, scoreB: true, phase: true, matchDate: true } },
    },
    orderBy: { match: { matchDate: "asc" } },
  });

  const bestPrediction = preds.reduce<typeof preds[number] | null>((best, p) => {
    if (!best || p.points > best.points) return p;
    return best;
  }, null);

  let longestStreak = 0;
  let cur = 0;
  for (const p of preds) {
    if (p.points > 0) {
      cur++;
      if (cur > longestStreak) longestStreak = cur;
    } else {
      cur = 0;
    }
  }

  const phaseAgg = new Map<string, { wins: number; total: number }>();
  for (const p of preds) {
    const slot = phaseAgg.get(p.match.phase) ?? { wins: 0, total: 0 };
    slot.total++;
    if (p.points > 0) slot.wins++;
    phaseAgg.set(p.match.phase, slot);
  }
  const precisionByPhase = Array.from(phaseAgg.entries()).map(([phase, v]) => ({
    phase,
    precision: v.total > 0 ? Math.round((v.wins / v.total) * 100) : 0,
    sampleSize: v.total,
  }));

  const daysActive = Math.max(1, Math.floor((Date.now() - dbUser.createdAt.getTime()) / 86_400_000));

  return NextResponse.json({
    insights: {
      bestPrediction: bestPrediction
        ? {
            scoreA: bestPrediction.scoreA,
            scoreB: bestPrediction.scoreB,
            points: bestPrediction.points,
            match: bestPrediction.match,
          }
        : null,
      longestStreak,
      precisionByPhase,
      daysActive,
    },
  });
}
