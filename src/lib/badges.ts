import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export interface BadgeDefinition {
  id: string;
  icon: string;
  name: string;
  description: string;
  target: number;
  evaluate: (userId: string, tournamentId: string) => Promise<number>;
}

const badgeDefinitions: BadgeDefinition[] = [
  {
    id: "francotirador",
    icon: "🎯",
    name: "Francotirador",
    description: "5 resultados exactos",
    target: 5,
    evaluate: async (userId) => {
      // Count exact scores by comparing predicted vs actual
      const preds = await prisma.prediction.findMany({
        where: { userId, match: { status: "FINISHED" } },
        include: { match: { select: { scoreA: true, scoreB: true } } },
      });
      return preds.filter(
        (p) => p.match.scoreA != null && p.match.scoreB != null && p.scoreA === p.match.scoreA && p.scoreB === p.match.scoreB
      ).length;
    },
  },
  {
    id: "en_llamas",
    icon: "🔥",
    name: "En llamas",
    description: "Racha de 5 aciertos",
    target: 5,
    evaluate: async (userId) => {
      const preds = await prisma.prediction.findMany({
        where: { userId, match: { status: "FINISHED" } },
        orderBy: { match: { matchDate: "desc" } },
      });
      let streak = 0;
      for (const p of preds) {
        if (p.points > 0) streak++;
        else break;
      }
      return streak;
    },
  },
  {
    id: "lider",
    icon: "👑",
    name: "Lider",
    description: "Ser #1 en un grupo",
    target: 1,
    evaluate: async (userId) => {
      const memberships = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true, group: { select: { tournamentId: true, members: { select: { userId: true } } } } },
      });

      let leaderCount = 0;
      for (const m of memberships) {
        const memberIds = m.group.members.map((gm) => gm.userId);
        const pointsAgg = await prisma.prediction.groupBy({
          by: ["userId"],
          where: {
            userId: { in: memberIds },
            match: { tournamentId: m.group.tournamentId },
          },
          _sum: { points: true },
          orderBy: { _sum: { points: "desc" } },
          take: 1,
        });
        if (pointsAgg.length > 0 && pointsAgg[0].userId === userId) {
          leaderCount++;
        }
      }
      return leaderCount;
    },
  },
  {
    id: "social",
    icon: "📢",
    name: "Social",
    description: "Invitar 5 amigos",
    target: 5,
    evaluate: async (userId) => {
      return prisma.user.count({ where: { referredById: userId } });
    },
  },
  {
    id: "global",
    icon: "🌍",
    name: "Global",
    description: "Top 1000 mundial",
    target: 1,
    evaluate: async (userId, tournamentId) => {
      const userPoints = await prisma.prediction.aggregate({
        where: { userId, match: { tournamentId } },
        _sum: { points: true },
      });
      const pts = userPoints._sum.points || 0;
      const above = await prisma.prediction.groupBy({
        by: ["userId"],
        where: { match: { tournamentId } },
        _sum: { points: true },
        having: { points: { _sum: { gt: pts } } },
      });
      const position = above.length + 1;
      return position <= 1000 ? 1 : 0;
    },
  },
  {
    id: "perfecto",
    icon: "💯",
    name: "Perfecto",
    description: "Acertar toda una fecha",
    target: 1,
    evaluate: async (userId) => {
      const events = await prisma.xpEvent.count({
        where: { userId, reason: "matchday_complete" },
      });
      return events;
    },
  },
  {
    id: "veterano",
    icon: "💀",
    name: "Veterano",
    description: "Jugar 3+ torneos",
    target: 3,
    evaluate: async (userId) => {
      const tournaments = await prisma.prediction.findMany({
        where: { userId },
        select: { match: { select: { tournamentId: true } } },
        distinct: ["matchId"],
      });
      const uniqueTournaments = new Set(tournaments.map((t) => t.match.tournamentId));
      return uniqueTournaments.size;
    },
  },
  {
    id: "gamer",
    icon: "🎮",
    name: "Gamer",
    description: "Usar 10 boosters",
    target: 10,
    evaluate: async (userId) => {
      return prisma.prediction.count({
        where: { userId, boosterApplied: { not: null } },
      });
    },
  },
  {
    id: "fanatico",
    icon: "🏟️",
    name: "Fanatico",
    description: "Predecir 50 partidos",
    target: 50,
    evaluate: async (userId) => {
      return prisma.prediction.count({ where: { userId } });
    },
  },
];

export function getBadgeDefinitions() {
  return badgeDefinitions.map((b) => ({
    id: b.id,
    icon: b.icon,
    name: b.name,
    description: b.description,
    target: b.target,
  }));
}

export async function evaluateBadges(
  userId: string,
  tournamentId: string,
): Promise<string[]> {
  const existingBadges = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const earnedSet = new Set(existingBadges.map((b) => b.badgeId));
  const newBadges: string[] = [];

  for (const badge of badgeDefinitions) {
    if (earnedSet.has(badge.id)) continue;

    const progress = await badge.evaluate(userId, tournamentId);
    if (progress >= badge.target) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id },
      });
      newBadges.push(badge.id);

      // Notify
      await createNotification({
        userId,
        type: "badge",
        title: `Nuevo logro: ${badge.name}!`,
        body: badge.description,
        icon: badge.icon,
      });
    }
  }

  return newBadges;
}

export async function getUserBadgesWithProgress(
  userId: string,
  tournamentId: string,
) {
  const existingBadges = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true, earnedAt: true },
  });
  const earnedMap = new Map(existingBadges.map((b) => [b.badgeId, b.earnedAt]));

  const result = await Promise.all(
    badgeDefinitions.map(async (badge) => {
      const earned = earnedMap.has(badge.id);
      let progress = 0;
      if (!earned) {
        try {
          progress = await badge.evaluate(userId, tournamentId);
        } catch {
          progress = 0;
        }
      }
      return {
        id: badge.id,
        icon: badge.icon,
        name: badge.name,
        description: badge.description,
        earned,
        progress: earned ? badge.target : progress,
        target: badge.target,
        earnedAt: earnedMap.get(badge.id) || null,
      };
    }),
  );

  return result;
}
