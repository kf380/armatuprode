import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePointsDetailed, calculateXpForPrediction } from "@/lib/scoring";
import { notifyMatchResults, notifyRankingChanges, createChatSystemEvent } from "@/lib/notifications";
import { evaluateBadges } from "@/lib/badges";
import { creditCoins } from "@/lib/wallet";
import { WalletLotSource } from "@prisma/client";
import { log, logSettled } from "@/lib/log";
import { rateLimit, hashSecret } from "@/lib/ratelimit";
import { adminKeyFromRequest, isValidAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

function isKnockout(phase: string): boolean {
  return phase !== "GROUP_STAGE";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: admin key from Authorization header OR admin_session cookie.
  const adminKey = adminKeyFromRequest(request);
  if (!isValidAdmin(adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const adminRl = await rateLimit("adminByKey", hashSecret(adminKey!));
  if (!adminRl.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  const body = await request.json();
  const { scoreA, scoreB, qualifiedTeam } = body;

  if (scoreA == null || scoreB == null || scoreA < 0 || scoreB < 0) {
    return NextResponse.json({ error: "Scores invalidos" }, { status: 400 });
  }

  const { id } = await params;

  // Two-phase lock so a crashed scoring can be retried.
  // Phase A: claim `scoringLockedAt` atomically. Status stays !=FINISHED.
  // Phase C (end of handler): flip status to FINISHED.
  // If anything between A and C crashes, the next /finish call will see
  // scoringLockedAt set and refuse — *unless* the lock is stale (>10 min).
  // Stale locks can be released via /api/admin/match/[id]/release-lock.
  const STALE_LOCK_MS = 10 * 60 * 1000;
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_LOCK_MS);
  const claimed = await prisma.match.updateMany({
    where: {
      id,
      status: { not: "FINISHED" },
      OR: [
        { scoringLockedAt: null },
        { scoringLockedAt: { lt: staleCutoff } },
      ],
    },
    data: {
      scoreA,
      scoreB,
      minute: null,
      period: "FT",
      scoringLockedAt: now,
    },
  });
  if (claimed.count === 0) {
    const existing = await prisma.match.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
    }
    log("warn", "match_scoring_lock_conflict", { matchId: id, status: existing.status });
    return NextResponse.json(
      { error: "Partido ya finalizado o scoring en curso" },
      { status: 409 },
    );
  }
  log("info", "match_scoring_started", { matchId: id, scoreA, scoreB });

  // Re-fetch the freshly-updated match for the rest of the handler.
  const match = await prisma.match.findUniqueOrThrow({
    where: { id },
    include: { tournament: true },
  });

  // For knockout, set qualifiedTeam in a follow-up (kept separate from the
  // lock claim to keep the test-and-set statement tight).
  if (isKnockout(match.phase) && qualifiedTeam) {
    await prisma.match.update({
      where: { id },
      data: { qualifiedTeam },
    });
    match.qualifiedTeam = qualifiedTeam;
  }

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

    // Per-prediction credit promises — collected and awaited at end of iteration
    // so we avoid losing coins to serverless promise truncation.
    const coinPromises: Promise<unknown>[] = [];

    // Insurance booster: if user scored 0, refund 150 coins
    if (finalPoints === 0 && pred.boosterApplied === "insurance" && validActivation) {
      coinPromises.push(
        creditCoins({
          userId: pred.userId,
          amount: 150,
          source: WalletLotSource.WINNER,
          reason: "insurance_refund",
          idempotencyKey: `coin_insurance_${id}_${pred.userId}`,
        }),
      );
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
      coinPromises.push(
        creditCoins({
          userId: pred.userId,
          amount: 20,
          source: WalletLotSource.WINNER,
          reason: "correct_winner",
          idempotencyKey: `coin_winner_${id}_${pred.userId}`,
        }),
      );
    }

    if (breakdown.isExact) {
      // Exact: +50 coins
      coinPromises.push(
        creditCoins({
          userId: pred.userId,
          amount: 50,
          source: WalletLotSource.EXACT,
          reason: "exact_score",
          idempotencyKey: `coin_exact_${id}_${pred.userId}`,
        }),
      );
    }

    // Knockout: classifier correct bonus coins
    if (knockout && breakdown.qualifierCorrect) {
      coinPromises.push(
        creditCoins({
          userId: pred.userId,
          amount: 30,
          source: WalletLotSource.WINNER,
          reason: "correct_qualifier",
          idempotencyKey: `coin_qualifier_${id}_${pred.userId}`,
        }),
      );
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
          coinPromises.push(
            creditCoins({
              userId: pred.userId,
              amount: 100,
              source: WalletLotSource.STREAK,
              reason: "streak_5",
              idempotencyKey: `coin_streak_${id}_${pred.userId}`,
            }),
          );
        }
      }
    }

    // Await this prediction's coin credits before moving on. Sequential between
    // predictions keeps DB pool sane; small batch (≤4 promises) within iteration.
    if (coinPromises.length > 0) {
      await logSettled(
        "finish_coin_credit_failed",
        { matchId: id, userId: pred.userId },
        coinPromises,
      );
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

  const matchdayCoinPromises: Promise<unknown>[] = [];
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
        matchdayCoinPromises.push(
          creditCoins({
            userId,
            amount: 20,
            source: WalletLotSource.MATCHDAY,
            reason: "matchday_complete",
            idempotencyKey: `coin_matchday_${id}_${userId}`,
          }),
        );
      }
    }
  }
  if (matchdayCoinPromises.length > 0) {
    await logSettled(
      "finish_matchday_coin_failed",
      { matchId: id },
      matchdayCoinPromises,
    );
  }

  // Badges + notifications + chat events: gather and await with structured logs.
  const tailPromises: Promise<unknown>[] = [];
  for (const [userId] of userPointsMap) {
    tailPromises.push(evaluateBadges(userId, match.tournamentId));
  }
  tailPromises.push(notifyMatchResults(id, scoreA, scoreB, match.teamAName, match.teamBName));
  tailPromises.push(notifyRankingChanges(id, match.tournamentId));

  // Chat system events: notify all groups for this tournament
  tailPromises.push(
    (async () => {
      const groups = await prisma.group.findMany({ where: { tournamentId: match.tournamentId } });
      const text = `Partido terminado: ${match.teamAName} ${scoreA}-${scoreB} ${match.teamBName}`;
      await Promise.allSettled(
        groups.map((g) => createChatSystemEvent(g.id, text, "⚽")),
      );
    })(),
  );

  await logSettled(
    "finish_tail_side_effects_failed",
    { matchId: id, tournamentId: match.tournamentId },
    tailPromises,
  );

  // Phase C: only NOW flip status to FINISHED. If we crash before this, the
  // lock is stale-able (10min) and the operator can re-run /finish or release.
  await prisma.match.update({
    where: { id },
    data: { status: "FINISHED" },
  });

  log("info", "match_scoring_finished", {
    matchId: id,
    predictionsScored: predictions.length,
    finalScoreA: scoreA,
    finalScoreB: scoreB,
  });
  await logAdminAction(request, "finish_match", adminKey, {
    matchId: id,
    scoreA,
    scoreB,
    qualifiedTeam: qualifiedTeam ?? null,
    predictionsScored: predictions.length,
  });

  return NextResponse.json({
    scored: predictions.length,
    matchId: id,
    finalScore: { scoreA, scoreB },
    ...(qualifiedTeam ? { qualifiedTeam } : {}),
  });
}
