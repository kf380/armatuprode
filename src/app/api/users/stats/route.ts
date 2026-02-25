import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const tournamentIdParam = searchParams.get("tournamentId");

  const tournament = tournamentIdParam
    ? await prisma.tournament.findUnique({ where: { id: tournamentIdParam } })
    : await prisma.tournament.findFirst({ where: { active: true } });

  if (!tournament) {
    return NextResponse.json({
      stats: { points: 0, globalRank: 0, streak: 0, precision: 0, exactos: 0, predictions: 0 },
    });
  }

  // Get all user predictions for active tournament
  const predictions = await prisma.prediction.findMany({
    where: { userId: dbUser.id, match: { tournamentId: tournament.id } },
    include: { match: true },
    orderBy: { match: { matchDate: "desc" } },
  });

  const totalPredictions = predictions.length;
  const totalPoints = predictions.reduce((sum, p) => sum + p.points, 0);
  // Count exactos by comparing predicted vs actual scores (works for groups and knockout)
  const exactos = predictions.filter((p) => {
    if (p.match.status !== "FINISHED" || p.match.scoreA == null || p.match.scoreB == null) return false;
    return p.scoreA === p.match.scoreA && p.scoreB === p.match.scoreB;
  }).length;

  // Precision: predictions on finished matches that earned points
  const finishedPredictions = predictions.filter((p) => p.match.status === "FINISHED");
  const correct = finishedPredictions.filter((p) => p.points > 0).length;
  const precision = finishedPredictions.length > 0 ? Math.round((correct / finishedPredictions.length) * 100) : 0;

  // Streak: consecutive correct predictions on finished matches (ordered by date desc)
  let streak = 0;
  for (const p of finishedPredictions) {
    if (p.points > 0) {
      streak++;
    } else {
      break;
    }
  }

  // Global rank: count users with more points
  const allPoints = await prisma.prediction.groupBy({
    by: ["userId"],
    where: { match: { tournamentId: tournament.id } },
    _sum: { points: true },
  });

  const usersAbove = allPoints.filter((a) => (a._sum.points || 0) > totalPoints).length;
  const globalRank = usersAbove + 1;

  return NextResponse.json({
    stats: {
      points: totalPoints,
      globalRank,
      streak,
      precision,
      exactos,
      predictions: totalPredictions,
    },
  });
}
