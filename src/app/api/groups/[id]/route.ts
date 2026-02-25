import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      tournament: { select: { id: true, name: true, type: true } },
      members: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true, country: true, xp: true },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  // Verify user is a member of this group
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser || !group.members.some((m) => m.userId === dbUser.id)) {
    return NextResponse.json({ error: "No sos miembro de este grupo" }, { status: 403 });
  }

  const memberIds = group.members.map((m) => m.userId);
  const predictions = await prisma.prediction.findMany({
    where: {
      userId: { in: memberIds },
      match: { tournamentId: group.tournamentId },
    },
    select: { userId: true, points: true },
  });

  const pointsByUser: Record<string, number> = {};
  for (const p of predictions) {
    pointsByUser[p.userId] = (pointsByUser[p.userId] || 0) + p.points;
  }

  const ranking = group.members
    .map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      avatar: m.user.avatar,
      country: m.user.country,
      points: pointsByUser[m.userId] || 0,
      role: m.role,
    }))
    .sort((a, b) => b.points - a.points);

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      tournament: group.tournament,
      memberCount: group._count.members,
      hasPool: group.hasPool,
      entryFee: group.entryFee,
      currency: group.currency,
      inviteCode: group.inviteCode,
    },
    ranking,
  });
}
