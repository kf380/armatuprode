import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import {
  readDashboardCache,
  writeDashboardCache,
  readGlobalDashCache,
  writeGlobalDashCache,
} from "@/lib/dashboard-cache";

type GlobalDashData = {
  tournament: { id: string; name: string; type: string; slug: string | null };
  matches: Array<{
    id: string;
    officialMatchNumber: number | null;
    teamACode: string;
    teamAName: string;
    teamAFlag: string | null;
    teamBCode: string;
    teamBName: string;
    teamBFlag: string | null;
    matchDate: string;
    matchGroup: string | null;
    phase: string;
    status: string;
    scoreA: number | null;
    scoreB: number | null;
    qualifiedTeam: string | null;
    minute: number | null;
    period: string | null;
  }>;
  allPointsAgg: Array<{ userId: string; totalPoints: number }>;
};

async function getGlobalData(tournamentId: string): Promise<GlobalDashData | null> {
  const cached = await readGlobalDashCache<GlobalDashData>(tournamentId);
  if (cached) return cached;

  const [tournament, matches, allPointsAgg] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, type: true, slug: true },
    }),
    prisma.match.findMany({
      where: { tournamentId },
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
    prisma.prediction.groupBy({
      by: ["userId"],
      where: { match: { tournamentId } },
      _sum: { points: true },
    }),
  ]);

  if (!tournament) return null;

  const data: GlobalDashData = {
    tournament,
    matches: matches.map((m) => ({
      ...m,
      matchDate: m.matchDate.toISOString(),
    })),
    allPointsAgg: allPointsAgg.map((a) => ({
      userId: a.userId,
      totalPoints: a._sum.points ?? 0,
    })),
  };

  void writeGlobalDashCache(tournamentId, data);
  return data;
}

/**
 * Aggregated dashboard payload. Global expensive queries (matches, allPointsAgg)
 * are served from Redis (TTL 5min). User-specific queries (predictions, groups,
 * badges) run in parallel — they're indexed and fast (~100-200ms).
 *
 * Cold start breakdown:
 *   auth:          ~150ms
 *   global cache:  ~50ms  (Redis hit) vs ~2s (DB miss, cached for next user)
 *   user queries:  ~200-400ms (3 parallel indexed queries)
 *   Total:         ~400-600ms warm, ~2.5s first-ever cold (cache population)
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

  // Per-user short-TTL cache (30s): covers rapid tab-switching / double fetches.
  const cached = await readDashboardCache<unknown>(dbUser.id);
  if (cached) {
    return NextResponse.json(cached);
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

  // Global data (matches + allPointsAgg) from Redis — shared across all users.
  // User-specific data fetched in parallel since it's fast (indexed queries).
  const [global, userPredictions, badges, memberships] = await Promise.all([
    getGlobalData(tournament.id),
    prisma.prediction.findMany({
      where: { userId: dbUser.id, match: { tournamentId: tournament.id } },
      select: { matchId: true, scoreA: true, scoreB: true, points: true, predictedQualifier: true },
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
            inviteCode: true,
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

  if (!global) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const { matches, allPointsAgg } = global;

  // Derive stats from in-memory data — zero DB queries.
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

  const finishedMatchesDesc = [...matches]
    .filter((m) => m.status === "FINISHED")
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  let streak = 0;
  for (const m of finishedMatchesDesc) {
    const p = predictionsByMatch.get(m.id);
    if (p && p.points > 0) streak++;
    else break;
  }

  const usersAbove = allPointsAgg.filter((a) => a.totalPoints > totalPoints).length;
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

  const payload = {
    stats: {
      points: totalPoints,
      globalRank,
      streak,
      precision,
      exactos,
      predictions: userPredictions.length,
    },
    tournament: global.tournament,
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
      inviteCode: m.group.inviteCode,
    })),
    badges: badges.map((b) => ({ id: b.badgeId, earnedAt: b.earnedAt.toISOString() })),
  };

  void writeDashboardCache(dbUser.id, payload);
  return NextResponse.json(payload);
}
