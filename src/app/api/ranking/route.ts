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

  const { searchParams } = new URL(request.url);
  const tournamentIdParam = searchParams.get("tournamentId");

  const tournament = tournamentIdParam
    ? await prisma.tournament.findUnique({ where: { id: tournamentIdParam } })
    : await prisma.tournament.findFirst({ where: { active: true } });

  if (!tournament) {
    return NextResponse.json({ ranking: [], userPosition: null, totalPlayers: 0 });
  }

  // Aggregate points per user for the active tournament
  const pointsAgg = await prisma.prediction.groupBy({
    by: ["userId"],
    where: { match: { tournamentId: tournament.id } },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: 100,
  });

  // Get all user IDs for the top 100
  const userIds = pointsAgg.map((p) => p.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatar: true, country: true, xp: true },
  });

  const usersMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const ranking = pointsAgg.map((p, i) => {
    const u = usersMap[p.userId];
    return {
      position: i + 1,
      userId: p.userId,
      name: u?.name || "Jugador",
      avatar: u?.avatar || "👤",
      country: u?.country || "🌍",
      points: p._sum.points || 0,
      level: u ? Math.floor(u.xp / 100) + 1 : 1,
    };
  });

  // Total players who have predictions
  const totalPlayers = await prisma.prediction.groupBy({
    by: ["userId"],
    where: { match: { tournamentId: tournament.id } },
  });

  // Find current user position
  let userPosition = null;
  if (dbUser) {
    const existingInTop = ranking.find((r) => r.userId === dbUser.id);
    if (existingInTop) {
      userPosition = existingInTop;
    } else {
      // User not in top 100, compute their position
      const userPoints = await prisma.prediction.aggregate({
        where: { userId: dbUser.id, match: { tournamentId: tournament.id } },
        _sum: { points: true },
      });
      const pts = userPoints._sum.points || 0;

      // Count users with more points
      const above = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT p."userId") as count
        FROM "Prediction" p
        JOIN "Match" m ON p."matchId" = m.id
        WHERE m."tournamentId" = ${tournament.id}
        GROUP BY p."userId"
        HAVING SUM(p.points) > ${pts}
      `;

      const pos = above.length > 0 ? Number(above.length) + 1 : totalPlayers.length > 0 ? totalPlayers.length : 1;

      userPosition = {
        position: pos,
        userId: dbUser.id,
        name: dbUser.name,
        avatar: dbUser.avatar,
        country: dbUser.country,
        points: pts,
        level: Math.floor(dbUser.xp / 100) + 1,
      };
    }
  }

  return NextResponse.json({
    ranking,
    userPosition,
    totalPlayers: totalPlayers.length,
  });
}
