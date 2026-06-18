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

  const predictions = await prisma.prediction.findMany({
    where: { userId: dbUser.id, match: { tournamentId: tournament.id } },
    select: {
      scoreA: true,
      scoreB: true,
      points: true,
      match: { select: { status: true, scoreA: true, scoreB: true } },
    },
    orderBy: { match: { matchDate: "desc" } },
  });

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

  const above = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT p."userId")::bigint AS count
    FROM "Prediction" p
    JOIN "Match" m ON p."matchId" = m.id
    WHERE m."tournamentId" = ${tournament.id}
    GROUP BY p."userId"
    HAVING SUM(p.points) > ${totalPoints}
  `;
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
