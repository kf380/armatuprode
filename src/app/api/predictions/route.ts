import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { createActivityEvent } from "@/lib/notifications";

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
  const { matchId, scoreA, scoreB, boosterId } = body;

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

  // Consume booster if provided
  let appliedBooster: string | null = null;
  if (boosterId && ["x2", "shield", "second_chance"].includes(boosterId)) {
    const booster = await prisma.userBooster.findUnique({
      where: { userId_type: { userId: dbUser.id, type: boosterId } },
    });
    if (booster && booster.quantity > 0) {
      await prisma.userBooster.update({
        where: { id: booster.id },
        data: { quantity: { decrement: 1 } },
      });
      appliedBooster = boosterId;
    }
  }

  // Check if this is a new prediction (for XP)
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
    },
    create: {
      userId: dbUser.id,
      matchId,
      scoreA,
      scoreB,
      boosterApplied: appliedBooster,
    },
  });

  // Grant +10 XP for new predictions only
  if (!existing) {
    await prisma.xpEvent.create({
      data: { userId: dbUser.id, amount: 10, reason: "prediction_made", matchId },
    });
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { xp: { increment: 10 } },
    });

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
  }

  return NextResponse.json({ prediction });
}
