import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

/**
 * Aggregated dashboard payload. Replaces 5+ parallel hooks on Home with a
 * single round-trip. Each piece is computed in parallel via Promise.all.
 *
 * Returns:
 *   stats           — same shape as /api/users/stats
 *   tournament      — active tournament meta
 *   matches         — list with userPrediction merged (same shape as /api/matches)
 *   liveMatches     — currently-LIVE matches in the active tournament
 *   groups          — groups the user belongs to (lean shape)
 *   badges          — list of badges with earned flag (lean)
 */
export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const tournament = await prisma.tournament.findFirst({ where: { active: true } });
  if (!tournament) {
    return NextResponse.json({
      stats: { points: 0, globalRank: 0, streak: 0, precision: 0, exactos: 0, predictions: 0 },
      tournament: null,
      matches: [],
      liveMatches: [],
      groups: [],
      badges: [],
    });
  }

  // Fan-out: all reads in parallel. Each returns shaped data, merged below.
  const [
    matches,
    userPredictions,
    allPointsAgg,
    badges,
    memberships,
  ] = await Promise.all([
    prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { matchDate: "asc" },
      select: {
        id: true,
        officialMatchNumber: true,
        teamACode: true,
        teamAName: true,
        teamAFlag: true,
        teamBCode: true,
        teamBName: true,
        teamBFlag: true,
        matchDate: true,
        matchGroup: true,
        phase: true,
        status: true,
        scoreA: true,
        scoreB: true,
        qualifiedTeam: true,
        minute: true,
        period: true,
      },
    }),
    prisma.prediction.findMany({
      where: { userId: dbUser.id, match: { tournamentId: tournament.id } },
      select: { matchId: true, scoreA: true, scoreB: true, points: true, predictedQualifier: true },
    }),
    prisma.prediction.groupBy({
      by: ["userId"],
      where: { match: { tournamentId: tournament.id } },
      _sum: { points: true },
    }),
    prisma.userBadge.findMany({
      where: { userId: dbUser.id },
      select: { badgeId: true, earnedAt: true },
    }),
    prisma.groupMember.findMany({
      where: { userId: dbUser.id },
      select: {
        group: {
          select: {
            id: true,
            name: true,
            emoji: true,
            hasPool: true,
            entryFee: true,
            currency: true,
            tournament: { select: { name: true } },
            _count: { select: { members: true } },
          },
        },
      },
    }),
  ]);

  // Stats: derive from the joined data we already have.
  const predictionsByMatch = new Map(userPredictions.map((p) => [p.matchId, p]));
  let totalPoints = 0;
  let exactos = 0;
  let finishedCount = 0;
  let correct = 0;
  for (const m of matches) {
    const p = predictionsByMatch.get(m.id);
    if (!p) continue;
    totalPoints += p.points;
    if (m.status === "FINISHED") {
      finishedCount++;
      if (p.points > 0) correct++;
      if (m.scoreA != null && m.scoreB != null && p.scoreA === m.scoreA && p.scoreB === m.scoreB) {
        exactos++;
      }
    }
  }
  const precision = finishedCount > 0 ? Math.round((correct / finishedCount) * 100) : null;

  // Streak: walk finished matches newest-first.
  const finishedMatchesDesc = matches
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => b.matchDate.getTime() - a.matchDate.getTime());
  let streak = 0;
  for (const m of finishedMatchesDesc) {
    const p = predictionsByMatch.get(m.id);
    if (p && p.points > 0) streak++;
    else break;
  }

  const usersAbove = allPointsAgg.filter((a) => (a._sum.points || 0) > totalPoints).length;
  const globalRank = usersAbove + 1;

  const liveMatches = matches
    .filter((m) => m.status === "LIVE")
    .map((m) => {
      const p = predictionsByMatch.get(m.id);
      return {
        id: m.id,
        teamACode: m.teamACode,
        teamAName: m.teamAName,
        teamAFlag: m.teamAFlag,
        teamBCode: m.teamBCode,
        teamBName: m.teamBName,
        teamBFlag: m.teamBFlag,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        minute: m.minute,
        period: m.period,
        matchGroup: m.matchGroup,
        phase: m.phase,
        userPrediction: p ? { scoreA: p.scoreA, scoreB: p.scoreB } : null,
      };
    });

  return NextResponse.json({
    stats: {
      points: totalPoints,
      globalRank,
      streak,
      precision,
      exactos,
      predictions: userPredictions.length,
    },
    tournament: { id: tournament.id, name: tournament.name, type: tournament.type, slug: tournament.slug },
    matches: matches.map((m) => ({
      id: m.id,
      tournamentId: tournament.id,
      officialMatchNumber: m.officialMatchNumber,
      teamACode: m.teamACode,
      teamAName: m.teamAName,
      teamAFlag: m.teamAFlag,
      teamBCode: m.teamBCode,
      teamBName: m.teamBName,
      teamBFlag: m.teamBFlag,
      matchDate: m.matchDate,
      matchGroup: m.matchGroup,
      phase: m.phase,
      status: m.status,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      qualifiedTeam: m.qualifiedTeam,
      prediction: predictionsByMatch.get(m.id)
        ? {
            scoreA: predictionsByMatch.get(m.id)!.scoreA,
            scoreB: predictionsByMatch.get(m.id)!.scoreB,
            points: predictionsByMatch.get(m.id)!.points,
            predictedQualifier: predictionsByMatch.get(m.id)!.predictedQualifier,
          }
        : null,
    })),
    liveMatches,
    groups: memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      emoji: m.group.emoji,
      tournament: m.group.tournament.name,
      memberCount: m.group._count.members,
      hasPool: m.group.hasPool,
      currency: m.group.currency,
      entryFee: m.group.entryFee,
    })),
    badges: badges.map((b) => ({ id: b.badgeId, earnedAt: b.earnedAt.toISOString() })),
  });
}
