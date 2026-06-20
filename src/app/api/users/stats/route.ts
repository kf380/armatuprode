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

  // Wave 1: user + tournament in parallel.
  const [dbUser, tournament] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    tournamentIdParam
      ? prisma.tournament.findUnique({ where: { id: tournamentIdParam } })
      : prisma.tournament.findFirst({ where: { active: true } }),
  ]);

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (!tournament) {
    return NextResponse.json({
      stats: { points: 0, globalRank: 0, streak: 0, precision: 0, exactos: 0, predictions: 0 },
    });
  }

  // Wave 2: predictions + ranking aggregation in parallel.
  const [predictions, above] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId: dbUser.id, match: { tournamentId: tournament.id } },
      select: {
        scoreA: true,
        scoreB: true,
        points: true,
        match: { select: { status: true, scoreA: true, scoreB: true } },
      },
      orderBy: { match: { matchDate: "desc" } },
    }),
    // Ranking query runs in parallel while predictions are fetched — we'll use
    // totalPoints computed from predictions below to filter, but since we don't
    // know totalPoints yet we compute it from a subquery instead.
    prisma.$queryRaw<[{ rank: bigint }]>`
      SELECT COUNT(DISTINCT u2.id)::bigint AS rank
      FROM "User" u2
      JOIN "Prediction" p2 ON p2."userId" = u2.id
      JOIN "Match" m2 ON p2."matchId" = m2.id
      WHERE m2."tournamentId" = ${tournament.id}
        AND u2.id != ${dbUser.id}
      GROUP BY u2.id
      HAVING SUM(p2.points) > (
        SELECT COALESCE(SUM(p."points"), 0)
        FROM "Prediction" p
        JOIN "Match" m ON p."matchId" = m.id
        WHERE p."userId" = ${dbUser.id} AND m."tournamentId" = ${tournament.id}
      )
    `,
  ]);

  const totalPredictions = predictions.length;
  const totalPoints = predictions.reduce((sum, p) => sum + p.points, 0);
  const exactos = predictions.filter((p) => {
    if (p.match.status !== "FINISHED" || p.match.scoreA == null || p.match.scoreB == null) return false;
    return p.scoreA === p.match.scoreA && p.scoreB === p.match.scoreB;
  }).length;

  const finishedPredictions = predictions.filter((p) => p.match.status === "FINISHED");
  const correct = finishedPredictions.filter((p) => p.points > 0).length;
  const precision = finishedPredictions.length > 0 ? Math.round((correct / finishedPredictions.length) * 100) : 0;

  let streak = 0;
  for (const p of finishedPredictions) {
    if (p.points > 0) streak++;
    else break;
  }

  const globalRank = Number(above.length) + 1;

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
