import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

/**
 * "Tu rival" stats. For each other member of the group, computes
 * head-to-head against the requesting user inside this tournament:
 *   - diff: difference in total points (positive = you ahead)
 *   - youAheadOnLast5: how many of the last 5 finished matches you beat them
 *
 * Used by GroupsScreen to surface a conversational "Vs Facundo: +8 pts".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id: groupId } = await params;
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

  const memberIds = group.members.map((m) => m.userId);

  // Pull all predictions per member for this tournament in one query, sorted
  // by match date desc so we can slice last-5 cheaply in memory.
  const preds = await prisma.prediction.findMany({
    where: {
      userId: { in: memberIds },
      match: { tournamentId: group.tournamentId, status: "FINISHED" },
    },
    select: {
      userId: true,
      matchId: true,
      points: true,
      match: { select: { matchDate: true } },
    },
    orderBy: { match: { matchDate: "desc" } },
  });

  // Group totals + per-match map for head-to-head.
  const totalByUser = new Map<string, number>();
  for (const p of preds) {
    totalByUser.set(p.userId, (totalByUser.get(p.userId) ?? 0) + p.points);
  }
  const myTotal = totalByUser.get(dbUser.id) ?? 0;

  // Per match → per user points, ordered by date desc (already)
  const matchToPoints = new Map<string, Map<string, number>>();
  for (const p of preds) {
    if (!matchToPoints.has(p.matchId)) matchToPoints.set(p.matchId, new Map());
    matchToPoints.get(p.matchId)!.set(p.userId, p.points);
  }

  // Head-to-head over last 5 matches the user predicted in (any outcome).
  const myMatchIdsDesc = preds.filter((p) => p.userId === dbUser.id).map((p) => p.matchId);

  const rivals = group.members
    .filter((m) => m.userId !== dbUser.id && m.user)
    .map((m) => {
      const theirTotal = totalByUser.get(m.userId) ?? 0;
      const diff = myTotal - theirTotal;

      let youWonLast5 = 0;
      let theyWonLast5 = 0;
      let tieLast5 = 0;
      for (const matchId of myMatchIdsDesc.slice(0, 5)) {
        const map = matchToPoints.get(matchId);
        if (!map) continue;
        const mine = map.get(dbUser.id) ?? 0;
        const theirs = map.get(m.userId) ?? 0;
        if (mine > theirs) youWonLast5++;
        else if (theirs > mine) theyWonLast5++;
        else tieLast5++;
      }

      return {
        userId: m.userId,
        name: m.user!.name,
        avatar: m.user!.avatar,
        diff,
        myTotal,
        theirTotal,
        youWonLast5,
        theyWonLast5,
        tieLast5,
      };
    })
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return NextResponse.json({ rivals });
}
