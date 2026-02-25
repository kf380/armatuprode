import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePointsDetailed, calculateXpForPrediction } from "@/lib/scoring";
import { notifyMatchResults, notifyRankingChanges, createChatSystemEvent } from "@/lib/notifications";
import { evaluateBadges } from "@/lib/badges";
import { creditCoins } from "@/lib/wallet";
import { WalletLotSource } from "@prisma/client";

function isKnockout(phase: string): boolean {
  return phase !== "GROUP_STAGE";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: accept admin key in Authorization header or body (backwards compat)
  const authHeader = request.headers.get("authorization");
  const body = await request.json();
  const adminKey = authHeader?.replace("Bearer ", "") || body.adminKey;
  const { scoreA, scoreB, qualifiedTeam } = body;

  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (scoreA == null || scoreB == null || scoreA < 0 || scoreB < 0) {
    return NextResponse.json({ error: "Scores invalidos" }, { status: 400 });
  }

  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: { tournament: true },
  });

  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (match.status === "FINISHED") {
    return NextResponse.json({ error: "Partido ya finalizado" }, { status: 409 });
  }

  // Update match to FINISHED (include qualifiedTeam for knockout)
  await prisma.match.update({
    where: { id },
    data: {
      status: "FINISHED",
      scoreA,
      scoreB,
      minute: null,
      period: "FT",
      ...(isKnockout(match.phase) && qualifiedTeam ? { qualifiedTeam } : {}),
    },
  });

  // Score all predictions for this match
  const predictions = await prisma.prediction.findMany({
    where: { matchId: id },
  });

  const userPointsMap = new Map<string, number>();
  const knockout = isKnockout(match.phase);

  for (const pred of predictions) {
    const breakdown = calculatePointsDetailed(
      pred.scoreA,
      pred.scoreB,
      scoreA,
      scoreB,
      match.phase,
      pred.predictedQualifier,
      qualifiedTeam ?? null,
    );
    const points = breakdown.total;

    // Defense-in-depth: verify booster activation is valid
    let boosterMultiplier = 1;
    const activation = await prisma.boosterActivation.findUnique({
      where: { userId_matchId: { userId: pred.userId, matchId: id } },
    });
    const validActivation = activation && activation.createdAt < match.matchDate;

    if (pred.boosterApplied === "x2" && validActivation) {
      boosterMultiplier = 2;
    }

    // Shield booster: if user scored 0 but has shield, give 1pt
    let finalPoints = points * boosterMultiplier;
    if (finalPoints === 0 && pred.boosterApplied === "shield" && validActivation) {
      finalPoints = 1;
    }

    await prisma.prediction.update({
      where: { id: pred.id },
      data: { points: finalPoints },
    });

    userPointsMap.set(pred.userId, finalPoints);

    // Grant XP for the result (pass breakdown to avoid ambiguous point values)
    const xpRewards = calculateXpForPrediction(points, match.phase, breakdown.isExact, breakdown.isWinner);
    for (const reward of xpRewards) {
      await prisma.xpEvent.create({
        data: {
          userId: pred.userId,
          amount: reward.amount,
          reason: reward.reason,
          matchId: id,
        },
      });
      await prisma.user.update({
        where: { id: pred.userId },
        data: { xp: { increment: reward.amount } },
      });
    }

    // Coin rewards based on result
    if (breakdown.isWinner && !breakdown.isExact) {
      // Winner correct: +20 coins (knockout: +20 too)
      creditCoins({
        userId: pred.userId,
        amount: 20,
        source: WalletLotSource.WINNER,
        reason: "correct_winner",
        idempotencyKey: `coin_winner_${id}_${pred.userId}`,
      }).catch(() => {});
    }

    if (breakdown.isExact) {
      // Exact: +50 coins
      creditCoins({
        userId: pred.userId,
        amount: 50,
        source: WalletLotSource.EXACT,
        reason: "exact_score",
        idempotencyKey: `coin_exact_${id}_${pred.userId}`,
      }).catch(() => {});
    }

    // Knockout: classifier correct bonus coins
    if (knockout && breakdown.qualifierCorrect) {
      creditCoins({
        userId: pred.userId,
        amount: 30,
        source: WalletLotSource.WINNER,
        reason: "correct_qualifier",
        idempotencyKey: `coin_qualifier_${id}_${pred.userId}`,
      }).catch(() => {});
    }

    // Check streak (last 5 finished predictions all with points > 0)
    if (points > 0) {
      const recentPredictions = await prisma.prediction.findMany({
        where: {
          userId: pred.userId,
          match: { status: "FINISHED" },
        },
        orderBy: { match: { matchDate: "desc" } },
        take: 5,
      });

      if (recentPredictions.length === 5 && recentPredictions.every((p) => p.points > 0)) {
        // Check if we already gave streak XP recently (avoid double-granting)
        const recentStreak = await prisma.xpEvent.findFirst({
          where: {
            userId: pred.userId,
            reason: "streak_5",
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });

        if (!recentStreak) {
          await prisma.xpEvent.create({
            data: { userId: pred.userId, amount: 100, reason: "streak_5", matchId: id },
          });
          await prisma.user.update({
            where: { id: pred.userId },
            data: { xp: { increment: 100 } },
          });

          // +100 coins for streak
          creditCoins({
            userId: pred.userId,
            amount: 100,
            source: WalletLotSource.STREAK,
            reason: "streak_5",
            idempotencyKey: `coin_streak_${id}_${pred.userId}`,
          }).catch(() => {});
        }
      }
    }
  }

  // Check matchday complete for each user
  const matchDate = match.matchDate;
  const dayStart = new Date(matchDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(matchDate);
  dayEnd.setHours(23, 59, 59, 999);

  const sameDay = await prisma.match.findMany({
    where: {
      tournamentId: match.tournamentId,
      matchDate: { gte: dayStart, lte: dayEnd },
    },
  });

  const allFinished = sameDay.every((m) => m.status === "FINISHED" || m.id === id);

  if (allFinished && sameDay.length > 1) {
    for (const [userId] of userPointsMap) {
      const userDayPredictions = await prisma.prediction.findMany({
        where: {
          userId,
          matchId: { in: sameDay.map((m) => m.id) },
        },
      });

      // User predicted all matches of the day and all correct
      if (
        userDayPredictions.length === sameDay.length &&
        userDayPredictions.every((p) => p.points > 0)
      ) {
        await prisma.xpEvent.create({
          data: { userId, amount: 20, reason: "matchday_complete", matchId: id },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: 20 } },
        });

        // +20 coins for matchday complete
        creditCoins({
          userId,
          amount: 20,
          source: WalletLotSource.MATCHDAY,
          reason: "matchday_complete",
          idempotencyKey: `coin_matchday_${id}_${userId}`,
        }).catch(() => {});
      }
    }
  }

  // Evaluate badges for affected users (fire-and-forget)
  for (const [userId] of userPointsMap) {
    evaluateBadges(userId, match.tournamentId).catch(() => {});
  }

  // Send notifications (fire-and-forget)
  notifyMatchResults(id, scoreA, scoreB, match.teamAName, match.teamBName).catch(() => {});
  notifyRankingChanges(id, match.tournamentId).catch(() => {});

  // Chat system events: notify all groups for this tournament (fire-and-forget)
  prisma.group.findMany({ where: { tournamentId: match.tournamentId } })
    .then((groups) => {
      const text = `Partido terminado: ${match.teamAName} ${scoreA}-${scoreB} ${match.teamBName}`;
      for (const g of groups) {
        createChatSystemEvent(g.id, text, "⚽").catch(() => {});
      }
    })
    .catch(() => {});

  return NextResponse.json({
    scored: predictions.length,
    matchId: id,
    finalScore: { scoreA, scoreB },
    ...(qualifiedTeam ? { qualifiedTeam } : {}),
  });
}
