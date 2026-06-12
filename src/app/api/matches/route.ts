import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { rateLimit, hashSecret } from "@/lib/ratelimit";
import { adminKeyFromRequest, isValidAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { unstable_cache } from "next/cache";

// Shared tournament payload (matches list + tournament meta). 30s TTL.
// Per-user data (predictions) is fetched separately and merged below.
// Cache invalidates naturally — when scores update, the cached shape is the
// same; users see stale-by-up-to-30s during live matches (acceptable given
// the 30s polling on the client side anyway).
const getCachedTournament = unstable_cache(
  async (tournamentIdParam: string | null) => {
    const tournament = tournamentIdParam
      ? await prisma.tournament.findUnique({
          where: { id: tournamentIdParam },
          include: { matches: { orderBy: { matchDate: "asc" } } },
        })
      : await prisma.tournament.findFirst({
          where: { active: true },
          include: { matches: { orderBy: { matchDate: "asc" } } },
        });
    return tournament;
  },
  ["matches-route-tournament"],
  { revalidate: 30 },
);

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tournamentIdParam = searchParams.get("tournamentId");

  // Run cached tournament + user lookup in parallel.
  const [tournament, dbUser] = await Promise.all([
    getCachedTournament(tournamentIdParam),
    prisma.user.findUnique({ where: { authId: user.id } }),
  ]);

  if (!tournament) {
    return NextResponse.json({ matches: [] });
  }

  let predictions: Record<string, { scoreA: number; scoreB: number; points: number }> = {};
  if (dbUser) {
    const userPredictions = await prisma.prediction.findMany({
      where: {
        userId: dbUser.id,
        matchId: { in: tournament.matches.map((m) => m.id) },
      },
    });
    predictions = Object.fromEntries(
      userPredictions.map((p) => [p.matchId, { scoreA: p.scoreA, scoreB: p.scoreB, points: p.points }])
    );
  }

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      type: tournament.type,
      phase: tournament.phase,
      slug: tournament.slug,
      hostCountries: tournament.hostCountries,
    },
    matches: tournament.matches.map((m) => ({
      id: m.id,
      tournamentId: m.tournamentId,
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
      venue: m.venue,
      city: m.city,
      country: m.country,
      prediction: predictions[m.id] ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const adminKey = adminKeyFromRequest(request);
  if (!isValidAdmin(adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const adminRl = await rateLimit("adminByKey", hashSecret(adminKey!));
  if (!adminRl.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const body = await request.json();
  const {
    tournamentId,
    teamACode,
    teamAName,
    teamAFlag,
    teamBCode,
    teamBName,
    teamBFlag,
    matchDate,
    matchGroup,
    phase,
  } = body;

  if (!tournamentId || !teamACode || !teamAName || !teamAFlag || !teamBCode || !teamBName || !teamBFlag || !matchDate) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  const match = await prisma.match.create({
    data: {
      tournamentId,
      teamACode,
      teamAName,
      teamAFlag,
      teamBCode,
      teamBName,
      teamBFlag,
      matchDate: new Date(matchDate),
      matchGroup: matchGroup || null,
      phase: phase || "GROUP_STAGE",
    },
  });

  await logAdminAction(request, "create_match", adminKey, {
    matchId: match.id,
    tournamentId,
    teams: `${teamACode} vs ${teamBCode}`,
    matchDate,
    phase: phase || "GROUP_STAGE",
  });

  return NextResponse.json({ match }, { status: 201 });
}
