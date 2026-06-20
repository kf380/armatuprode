import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ pick: null });

  const tournament = await prisma.tournament.findFirst({ where: { active: true } });
  if (!tournament) return NextResponse.json({ pick: null });

  const pick = await prisma.tournamentPick.findUnique({
    where: { userId_tournamentId: { userId: dbUser.id, tournamentId: tournament.id } },
  });

  // Tally champion picks across all users for leaderboard-style display
  const championTally = await prisma.tournamentPick.groupBy({
    by: ["champion"],
    where: { tournamentId: tournament.id, champion: { not: null } },
    _count: { champion: true },
    orderBy: { _count: { champion: "desc" } },
    take: 10,
  });

  return NextResponse.json({
    pick,
    championTally: championTally.map((r) => ({ code: r.champion, count: r._count.champion })),
  });
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rl = await rateLimit("predictions", user.id);
  if (!rl.ok) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const tournament = await prisma.tournament.findFirst({ where: { active: true } });
  if (!tournament) return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });

  const body = await request.json();
  const { champion, topScorer } = body as { champion?: string; topScorer?: string };

  const pick = await prisma.tournamentPick.upsert({
    where: { userId_tournamentId: { userId: dbUser.id, tournamentId: tournament.id } },
    update: {
      ...(champion !== undefined ? { champion: champion || null } : {}),
      ...(topScorer !== undefined ? { topScorer: topScorer || null } : {}),
    },
    create: {
      userId: dbUser.id,
      tournamentId: tournament.id,
      champion: champion || null,
      topScorer: topScorer || null,
    },
  });

  return NextResponse.json({ pick });
}
