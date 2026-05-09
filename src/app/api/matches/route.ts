import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { rateLimit, hashSecret } from "@/lib/ratelimit";
import { adminKeyFromRequest, isValidAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tournamentIdParam = searchParams.get("tournamentId");

  const tournament = tournamentIdParam
    ? await prisma.tournament.findUnique({
        where: { id: tournamentIdParam },
        include: { matches: { orderBy: { matchDate: "asc" } } },
      })
    : await prisma.tournament.findFirst({
        where: { active: true },
        include: { matches: { orderBy: { matchDate: "asc" } } },
      });

  if (!tournament) {
    return NextResponse.json({ matches: [] });
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

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
