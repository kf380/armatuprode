import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TournamentPhase } from "@prisma/client";
import { getAuthUser } from "@/lib/supabase-server";
import { readRankingCache, writeRankingCache } from "@/lib/dashboard-cache";

const VALID_PHASES = new Set<string>(Object.values(TournamentPhase));

export async function GET(request: NextRequest) {
  try {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tournamentIdParam = searchParams.get("tournamentId");
  const rawPhase = searchParams.get("phase");
  // Validate phase against the enum — invalid values fall back to "all phases".
  const phaseParam: TournamentPhase | null =
    rawPhase && VALID_PHASES.has(rawPhase) ? (rawPhase as TournamentPhase) : null;

  // Parallelize: user lookup + tournament lookup don't depend on each other.
  const [dbUser, tournament] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    tournamentIdParam
      ? prisma.tournament.findUnique({ where: { id: tournamentIdParam } })
      : prisma.tournament.findFirst({ where: { active: true } }),
  ]);

  if (!tournament) {
    return NextResponse.json({ ranking: [], userPosition: null, totalPlayers: 0 });
  }

  // Cache hit: return immediately without touching the DB.
  const cacheKey = `${dbUser?.id ?? "anon"}:${phaseParam ?? "all"}`;
  const cached = await readRankingCache<object>(tournament.id, cacheKey);
  if (cached) return NextResponse.json(cached);

  const matchWhere = phaseParam
    ? { tournamentId: tournament.id, phase: phaseParam }
    : { tournamentId: tournament.id };

  // Parallelize: top-100 aggregation + total distinct players count.
  const [pointsAgg, totalResult] = await Promise.all([
    prisma.prediction.groupBy({
      by: ["userId"],
      where: { match: matchWhere },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 100,
    }),
    phaseParam
      ? prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT p."userId")::bigint AS count
          FROM "Prediction" p
          JOIN "Match" m ON p."matchId" = m.id
          WHERE m."tournamentId" = ${tournament.id}
            AND m."phase" = ${phaseParam}
        `
      : prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT p."userId")::bigint AS count
          FROM "Prediction" p
          JOIN "Match" m ON p."matchId" = m.id
          WHERE m."tournamentId" = ${tournament.id}
        `,
  ]);

  const totalPlayers = Number(totalResult[0]?.count ?? 0);

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

  // Find current user position.
  let userPosition = null;
  if (dbUser) {
    const existingInTop = ranking.find((r) => r.userId === dbUser.id);
    if (existingInTop) {
      userPosition = existingInTop;
    } else {
      const userPoints = await prisma.prediction.aggregate({
        where: { userId: dbUser.id, match: matchWhere },
        _sum: { points: true },
      });
      const pts = userPoints._sum.points || 0;

      const above = phaseParam
        ? await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT p."userId")::bigint AS count
            FROM "Prediction" p
            JOIN "Match" m ON p."matchId" = m.id
            WHERE m."tournamentId" = ${tournament.id}
              AND m."phase" = ${phaseParam}
            GROUP BY p."userId"
            HAVING SUM(p.points) > ${pts}
          `
        : await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(DISTINCT p."userId")::bigint AS count
            FROM "Prediction" p
            JOIN "Match" m ON p."matchId" = m.id
            WHERE m."tournamentId" = ${tournament.id}
            GROUP BY p."userId"
            HAVING SUM(p.points) > ${pts}
          `;

      userPosition = {
        position: above.length > 0 ? Number(above.length) + 1 : totalPlayers || 1,
        userId: dbUser.id,
        name: dbUser.name,
        avatar: dbUser.avatar,
        country: dbUser.country,
        points: pts,
        level: Math.floor(dbUser.xp / 100) + 1,
      };
    }
  }

  const payload = { ranking, userPosition, totalPlayers };
  await writeRankingCache(tournament.id, cacheKey, payload);

  return NextResponse.json(payload);
  } catch (e) {
    console.error("ranking_route_error", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
