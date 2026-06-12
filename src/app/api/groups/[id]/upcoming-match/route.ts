import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

/**
 * Próximo partido del torneo + pronósticos de cada miembro del grupo.
 * Pensado para el "Vs entre amigos" en GroupsScreen.
 *
 * Devuelve null si no hay próximo partido en la ventana de 7 días o si el
 * user no es miembro del grupo.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: groupId } = await params;

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      tournamentId: true,
      members: { select: { userId: true, user: { select: { id: true, name: true, avatar: true } } } },
    },
  });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  if (!group.members.some((m) => m.userId === dbUser.id)) {
    return NextResponse.json({ error: "No sos miembro" }, { status: 403 });
  }

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 86_400_000);

  const nextMatch = await prisma.match.findFirst({
    where: {
      tournamentId: group.tournamentId,
      status: "UPCOMING",
      matchDate: { gte: now, lte: in7days },
    },
    orderBy: { matchDate: "asc" },
    select: {
      id: true,
      teamAName: true,
      teamBName: true,
      teamAFlag: true,
      teamBFlag: true,
      teamACode: true,
      teamBCode: true,
      matchDate: true,
      phase: true,
    },
  });

  if (!nextMatch) return NextResponse.json({ match: null, predictions: [] });

  const memberIds = group.members.map((m) => m.userId);
  const predictions = await prisma.prediction.findMany({
    where: { userId: { in: memberIds }, matchId: nextMatch.id },
    select: { userId: true, scoreA: true, scoreB: true },
  });

  const byUserId = new Map(predictions.map((p) => [p.userId, p]));
  const friends = group.members.map((m) => {
    const p = byUserId.get(m.userId);
    return {
      userId: m.userId,
      name: m.user?.name ?? "Jugador",
      avatar: m.user?.avatar ?? "👤",
      scoreA: p?.scoreA ?? null,
      scoreB: p?.scoreB ?? null,
      isMe: m.userId === dbUser.id,
    };
  });

  return NextResponse.json({
    match: nextMatch,
    predictions: friends,
  });
}
