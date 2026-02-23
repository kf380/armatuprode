import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePoints, calculateXpForPrediction } from "@/lib/scoring";
import { notifyMatchResults, notifyRankingChanges } from "@/lib/notifications";
import { evaluateBadges } from "@/lib/badges";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await request.json();
  const { adminKey, scoreA, scoreB } = body;

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

  // Update match to FINISHED
  await prisma.match.update({
    where: { id },
    data: { status: "FINISHED", scoreA, scoreB },
  });

  // Score all predictions for this match
  const predictions = await prisma.prediction.findMany({
    where: { matchId: id },
  });

  const userPointsMap = new Map<string, number>();

  for (const pred of predictions) {
    const points = calculatePoints(pred.scoreA, pred.scoreB, scoreA, scoreB);
    const boosterMultiplier = pred.boosterApplied === "x2" ? 2 : 1;
    const finalPoints = points * boosterMultiplier;

    await prisma.prediction.update({
      where: { id: pred.id },
      data: { points: finalPoints },
    });

    userPointsMap.set(pred.userId, finalPoints);

    // Grant XP for the result
    const xpRewards = calculateXpForPrediction(points);
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
        }
      }
    }

    // Shield booster: if failed and has shield, don't count it as breaking the streak
    // (streak logic above naturally handles this since shield predictions won't be points=0)
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

  return NextResponse.json({
    scored: predictions.length,
    matchId: id,
    finalScore: { scoreA, scoreB },
  });
}
