import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });

  // Get all LIVE matches
  const liveMatches = await prisma.match.findMany({
    where: { status: "LIVE" },
    include: { tournament: true },
  });

  if (liveMatches.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  // Get user predictions for live matches
  const predictions = dbUser
    ? await prisma.prediction.findMany({
        where: {
          userId: dbUser.id,
          matchId: { in: liveMatches.map((m) => m.id) },
        },
      })
    : [];
  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));

  // Get user's groups for live ranking
  const memberships = dbUser
    ? await prisma.groupMember.findMany({
        where: { userId: dbUser.id },
        include: { group: true },
      })
    : [];

  // For each live match, get group rankings
  const matchesWithRanking = await Promise.all(
    liveMatches.map(async (match) => {
      const userGroups = memberships.filter(
        (m) => m.group.tournamentId === match.tournamentId,
      );

      const groupRankings = await Promise.all(
        userGroups.map(async (mg) => {
          const members = await prisma.groupMember.findMany({
            where: { groupId: mg.groupId },
            include: { user: true },
          });

          const memberPredictions = await prisma.prediction.findMany({
            where: {
              matchId: match.id,
              userId: { in: members.map((m) => m.userId) },
            },
          });

          const predictionMap = Object.fromEntries(
            memberPredictions.map((p) => [p.userId, p]),
          );

          const ranking = members
            .map((m) => {
              const pred = predictionMap[m.userId];
              return {
                userId: m.userId,
                name: m.user.name,
                avatar: m.user.avatar,
                prediction: pred
                  ? `${pred.scoreA}-${pred.scoreB}`
                  : null,
                isUser: m.userId === dbUser?.id,
              };
            })
            .filter((r) => r.prediction !== null);

          return {
            groupId: mg.groupId,
            groupName: mg.group.name,
            groupEmoji: mg.group.emoji,
            ranking,
          };
        }),
      );

      return {
        id: match.id,
        teamACode: match.teamACode,
        teamAName: match.teamAName,
        teamAFlag: match.teamAFlag,
        teamBCode: match.teamBCode,
        teamBName: match.teamBName,
        teamBFlag: match.teamBFlag,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        minute: match.minute,
        period: match.period,
        matchGroup: match.matchGroup,
        phase: match.phase,
        userPrediction: predMap[match.id]
          ? { scoreA: predMap[match.id].scoreA, scoreB: predMap[match.id].scoreB }
          : null,
        groupRankings,
      };
    }),
  );

  return NextResponse.json({ matches: matchesWithRanking });
}
