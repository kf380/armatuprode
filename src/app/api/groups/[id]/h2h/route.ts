import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id: groupId } = await params;
  const { searchParams } = new URL(request.url);
  const vsId = searchParams.get("vs");
  if (!vsId) return NextResponse.json({ error: "Parámetro vs requerido" }, { status: 400 });

  const [dbUser, rival, group] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.user.findUnique({ where: { id: vsId }, select: { id: true, name: true, avatar: true } }),
    prisma.group.findUnique({ where: { id: groupId }, select: { tournamentId: true } }),
  ]);

  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!rival) return NextResponse.json({ error: "Rival no encontrado" }, { status: 404 });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  // Both must be members of the group
  const [myMembership, rivalMembership] = await Promise.all([
    prisma.groupMember.findUnique({ where: { userId_groupId: { userId: dbUser.id, groupId } } }),
    prisma.groupMember.findUnique({ where: { userId_groupId: { userId: vsId, groupId } } }),
  ]);
  if (!myMembership || !rivalMembership) {
    return NextResponse.json({ error: "Ambos jugadores deben estar en el grupo" }, { status: 403 });
  }

  const matches = await prisma.match.findMany({
    where: { tournamentId: group.tournamentId, status: { in: ["FINISHED", "LIVE"] } },
    orderBy: { matchDate: "asc" },
  });

  if (matches.length === 0) {
    return NextResponse.json({
      me: { id: dbUser.id, name: dbUser.name, avatar: dbUser.avatar, totalPoints: 0 },
      rival: { id: rival.id, name: rival.name, avatar: rival.avatar, totalPoints: 0 },
      matches: [],
    });
  }

  const matchIds = matches.map((m) => m.id);

  const [myPreds, rivalPreds] = await Promise.all([
    prisma.prediction.findMany({ where: { userId: dbUser.id, matchId: { in: matchIds } } }),
    prisma.prediction.findMany({ where: { userId: vsId, matchId: { in: matchIds } } }),
  ]);

  const myMap = Object.fromEntries(myPreds.map((p) => [p.matchId, p]));
  const rivalMap = Object.fromEntries(rivalPreds.map((p) => [p.matchId, p]));

  const h2hMatches = matches.map((m) => {
    const mp = myMap[m.id];
    const rp = rivalMap[m.id];
    return {
      matchId: m.id,
      teamACode: m.teamACode,
      teamAName: m.teamAName,
      teamAFlag: m.teamAFlag,
      teamBCode: m.teamBCode,
      teamBName: m.teamBName,
      teamBFlag: m.teamBFlag,
      phase: m.phase,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      status: m.status,
      myPrediction: mp ? { scoreA: mp.scoreA, scoreB: mp.scoreB, points: mp.points ?? 0 } : null,
      rivalPrediction: rp ? { scoreA: rp.scoreA, scoreB: rp.scoreB, points: rp.points ?? 0 } : null,
    };
  });

  // Only include matches where at least one of them predicted
  const relevant = h2hMatches.filter((m) => m.myPrediction || m.rivalPrediction);

  const myTotal = myPreds.reduce((s, p) => s + (p.points ?? 0), 0);
  const rivalTotal = rivalPreds.reduce((s, p) => s + (p.points ?? 0), 0);

  return NextResponse.json({
    me: { id: dbUser.id, name: dbUser.name, avatar: dbUser.avatar, totalPoints: myTotal },
    rival: { id: rival.id, name: rival.name, avatar: rival.avatar, totalPoints: rivalTotal },
    matches: relevant,
  });
}
