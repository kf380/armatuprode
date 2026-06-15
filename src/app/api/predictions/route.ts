import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { createActivityEvent, createChatSystemEvent } from "@/lib/notifications";
import { creditCoins } from "@/lib/wallet";
import { WalletLotSource } from "@prisma/client";
import { log, logSettled } from "@/lib/log";
import { rateLimit } from "@/lib/ratelimit";
import { trackServer } from "@/lib/analytics-server";
import { invalidateDashboardCache } from "@/lib/dashboard-cache";

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

  const predictions = await prisma.prediction.findMany({
    where: { userId: dbUser.id },
    include: { match: true },
    orderBy: { match: { matchDate: "asc" } },
  });

  return NextResponse.json({ predictions });
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rl = await rateLimit("predictions", user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Demasiadas predicciones, esperá un momento" },
      { status: 429 },
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const { matchId, scoreA, scoreB, boosterId, predictedQualifier } = body;

  if (!matchId || scoreA == null || scoreB == null) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  if (scoreA < 0 || scoreB < 0 || !Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return NextResponse.json({ error: "Puntajes invalidos" }, { status: 400 });
  }

  if (scoreA > 20 || scoreB > 20) {
    return NextResponse.json({ error: "Puntaje maximo es 20" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (match.status !== "UPCOMING" || new Date(match.matchDate) <= new Date()) {
    return NextResponse.json({ error: "El partido ya comenzo, no se puede predecir" }, { status: 403 });
  }

  // Validate predictedQualifier for knockout matches
  if (predictedQualifier && match.phase !== "GROUP_STAGE") {
    const validTeams = [match.teamACode, match.teamBCode];
    if (!validTeams.includes(predictedQualifier)) {
      return NextResponse.json({ error: "Clasificado invalido, debe ser uno de los dos equipos" }, { status: 400 });
    }
  }

  // Consume booster if provided (wrapped in transaction to prevent race condition)
  let appliedBooster: string | null = null;
  if (boosterId && ["x2", "shield", "insurance"].includes(boosterId)) {
    // Anti-exploit: validate match hasn't started server-side
    if (new Date(match.matchDate) <= new Date()) {
      return NextResponse.json({ error: "No se puede activar booster despues del inicio del partido" }, { status: 403 });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const booster = await tx.userBooster.findUnique({
          where: { userId_type: { userId: dbUser.id, type: boosterId } },
        });
        if (!booster || booster.quantity <= 0) {
          throw new Error("NO_BOOSTER");
        }

        // Create activation first (unique constraint check)
        await tx.boosterActivation.create({
          data: {
            userId: dbUser.id,
            matchId,
            type: boosterId,
          },
        });

        // Only decrement after activation succeeds
        await tx.userBooster.update({
          where: { id: booster.id },
          data: { quantity: { decrement: 1 } },
        });
      });
      appliedBooster = boosterId;
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "NO_BOOSTER") {
        return NextResponse.json({ error: "No tenes ese booster" }, { status: 400 });
      }
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        return NextResponse.json({ error: "Ya tenes un booster activo para este partido" }, { status: 409 });
      }
      throw e;
    }
  }

  // Check if this is a new prediction (for XP + coins)
  const existing = await prisma.prediction.findUnique({
    where: { userId_matchId: { userId: dbUser.id, matchId } },
  });

  const prediction = await prisma.prediction.upsert({
    where: {
      userId_matchId: {
        userId: dbUser.id,
        matchId,
      },
    },
    update: {
      scoreA,
      scoreB,
      ...(appliedBooster ? { boosterApplied: appliedBooster } : {}),
      ...(predictedQualifier !== undefined && match.phase !== "GROUP_STAGE"
        ? { predictedQualifier }
        : {}),
    },
    create: {
      userId: dbUser.id,
      matchId,
      scoreA,
      scoreB,
      boosterApplied: appliedBooster,
      predictedQualifier: match.phase !== "GROUP_STAGE" ? predictedQualifier ?? null : null,
    },
  });

  // Invalidar cache server-side del dashboard para que el próximo GET traiga
  // la prediction recién guardada (sino el user ve el old payload por 30s).
  void invalidateDashboardCache(dbUser.id);

  if (!existing) {
    log("info", "prediction_created", { userId: dbUser.id, matchId, scoreA, scoreB });
    void trackServer(dbUser.id, "prediction_made", {
      match_id: matchId,
      phase: match.phase,
      booster_applied: appliedBooster,
    });
  } else {
    void trackServer(dbUser.id, "prediction_updated", { match_id: matchId });
  }
  // Grant +10 XP and +10 coins for new predictions only
  if (!existing) {
    await prisma.xpEvent.create({
      data: { userId: dbUser.id, amount: 10, reason: "prediction_made", matchId },
    });
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { xp: { increment: 10 } },
    });

    // +10 coins for new prediction. Idempotent by coin_pred_<matchId>_<userId>.
    // Awaited so we don't lose coins to serverless promise truncation.
    await logSettled(
      "predictions_side_effects_failed",
      { userId: dbUser.id, matchId },
      [
        creditCoins({
          userId: dbUser.id,
          amount: 10,
          source: WalletLotSource.PREDICTION,
          reason: "prediction_made",
          idempotencyKey: `coin_pred_${matchId}_${dbUser.id}`,
        }),
      ],
    );

    // Activity events + chat system events: gather and await as a batch.
    const memberships = await prisma.groupMember.findMany({
      where: { userId: dbUser.id },
      include: { group: true },
    });

    const sideEffects: Promise<unknown>[] = [];
    const timeUntil = new Date(match.matchDate).getTime() - Date.now();
    const closingSoon = timeUntil > 0 && timeUntil < 5 * 60 * 1000;

    for (const m of memberships) {
      if (m.group.tournamentId !== match.tournamentId) continue;
      sideEffects.push(
        createActivityEvent({
          groupId: m.groupId,
          userId: dbUser.id,
          type: "prediction",
          text: `hizo su prediccion para ${match.teamAName} vs ${match.teamBName}`,
          icon: "⚽",
        }),
      );
      if (closingSoon) {
        sideEffects.push(
          createChatSystemEvent(
            m.groupId,
            `Predicciones cerradas: ${match.teamACode} vs ${match.teamBCode}`,
            "🔒",
          ),
        );
      }
    }

    if (sideEffects.length > 0) {
      await logSettled(
        "predictions_chat_events_failed",
        { userId: dbUser.id, matchId },
        sideEffects,
      );
    }
  }

  return NextResponse.json({ prediction });
}
