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
