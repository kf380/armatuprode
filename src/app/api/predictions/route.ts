import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { createActivityEvent, createChatSystemEvent } from "@/lib/notifications";
import { creditCoins } from "@/lib/wallet";
import { WalletLotSource } from "@prisma/client";

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

  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  // second_chance booster: allow changing up to 30min before match
  const timeUntilMatch = new Date(match.matchDate).getTime() - Date.now();
  const isSecondChance = boosterId === "second_chance" && timeUntilMatch > 0;

  if (match.status !== "UPCOMING" || (new Date(match.matchDate) <= new Date() && !isSecondChance)) {
    return NextResponse.json({ error: "El partido ya comenzo, no se puede predecir" }, { status: 403 });
  }

  // Validate predictedQualifier for knockout matches
  if (predictedQualifier && match.phase !== "GROUP_STAGE") {
    const validTeams = [match.teamACode, match.teamBCode];
    if (!validTeams.includes(predictedQualifier)) {
      return NextResponse.json({ error: "Clasificado invalido, debe ser uno de los dos equipos" }, { status: 400 });
    }
  }

  // Consume booster if provided
  let appliedBooster: string | null = null;
  if (boosterId && ["x2", "shield", "second_chance"].includes(boosterId)) {
    // Anti-exploit: validate match hasn't started server-side
    if (new Date(match.matchDate) <= new Date()) {
      return NextResponse.json({ error: "No se puede activar booster despues del inicio del partido" }, { status: 403 });
    }

    const booster = await prisma.userBooster.findUnique({
      where: { userId_type: { userId: dbUser.id, type: boosterId } },
    });
    if (booster && booster.quantity > 0) {
      await prisma.userBooster.update({
        where: { id: booster.id },
        data: { quantity: { decrement: 1 } },
      });
      appliedBooster = boosterId;

      // Create BoosterActivation record (@@unique prevents double activation)
      try {
        await prisma.boosterActivation.create({
          data: {
            userId: dbUser.id,
            matchId,
            type: boosterId,
          },
        });
      } catch (e: unknown) {
        // P2002 = unique constraint violation → already has booster for this match
        if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
          return NextResponse.json({ error: "Ya tenes un booster activo para este partido" }, { status: 409 });
        }
        throw e;
      }
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

  // Grant +10 XP and +10 coins for new predictions only
  if (!existing) {
    await prisma.xpEvent.create({
      data: { userId: dbUser.id, amount: 10, reason: "prediction_made", matchId },
    });
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { xp: { increment: 10 } },
    });

    // +10 coins for new prediction
    creditCoins({
      userId: dbUser.id,
      amount: 10,
      source: WalletLotSource.PREDICTION,
      reason: "prediction_made",
      idempotencyKey: `coin_pred_${matchId}_${dbUser.id}`,
    }).catch(() => {});

    // Create activity events in user's groups
    const memberships = await prisma.groupMember.findMany({
      where: { userId: dbUser.id },
      include: { group: true },
    });

    for (const m of memberships) {
      if (m.group.tournamentId === match.tournamentId) {
        createActivityEvent({
          groupId: m.groupId,
          userId: dbUser.id,
          type: "prediction",
          text: `hizo su prediccion para ${match.teamAName} vs ${match.teamBName}`,
          icon: "⚽",
        }).catch(() => {});
      }
    }

    // Chat system event if match starts in <5 min
    const timeUntil = new Date(match.matchDate).getTime() - Date.now();
    if (timeUntil > 0 && timeUntil < 5 * 60 * 1000) {
      for (const m of memberships) {
        if (m.group.tournamentId === match.tournamentId) {
          createChatSystemEvent(
            m.groupId,
            `Predicciones cerradas: ${match.teamACode} vs ${match.teamBCode}`,
            "🔒",
          ).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ prediction });
}
