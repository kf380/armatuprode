import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

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
    },
    matches: tournament.matches.map((m) => ({
      ...m,
      prediction: predictions[m.id] ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const body = await request.json();
  const adminKey = authHeader?.replace("Bearer ", "") || body.adminKey;

  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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

  return NextResponse.json({ match }, { status: 201 });
}
