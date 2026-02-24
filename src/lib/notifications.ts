import { prisma } from "@/lib/prisma";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  icon?: string;
}) {
  const notif = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      icon: params.icon ?? "🔔",
    },
  });

  // Try to send push notification (fire-and-forget)
  try {
    const { sendPushToUser } = await import("@/lib/push");
    await sendPushToUser(params.userId, params.title, params.body);
  } catch {
    // Push not available or failed — OK
  }

  return notif;
}

export async function createChatSystemEvent(
  groupId: string,
  text: string,
  icon: string = "⚡",
) {
  return prisma.chatMessage.create({
    data: {
      groupId,
      userId: null,
      type: "SYSTEM",
      content: `${icon} ${text}`,
    },
  });
}

export async function createActivityEvent(params: {
  groupId: string;
  userId: string;
  type: string;
  text: string;
  icon: string;
}) {
  return prisma.activityEvent.create({ data: params });
}

export async function notifyMatchResults(
  matchId: string,
  scoreA: number,
  scoreB: number,
  teamA: string,
  teamB: string,
) {
  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    include: { user: true },
  });

  for (const pred of predictions) {
    const isExact = pred.points === 3 || (pred.boosterApplied === "x2" && pred.points === 6);
    const isCorrect = pred.points > 0;

    const icon = isExact ? "🎯" : isCorrect ? "✅" : "❌";
    const title = isExact
      ? "Resultado exacto!"
      : isCorrect
        ? "Acertaste el ganador!"
        : "No acertaste esta vez";
    const body = `${teamA} ${scoreA}-${scoreB} ${teamB}. ${isExact ? `+${pred.points} pts y +50 XP` : isCorrect ? `+${pred.points} pts y +20 XP` : "Segui intentando!"}`;

    await createNotification({
      userId: pred.userId,
      type: "result",
      title,
      body,
      icon,
    });
  }
}

export async function notifyRankingChanges(
  matchId: string,
  tournamentId: string,
) {
  // Get users who had predictions for this match
  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    select: { userId: true },
  });

  const userIds = predictions.map((p) => p.userId);

  // Get their group memberships
  const memberships = await prisma.groupMember.findMany({
    where: { userId: { in: userIds }, group: { tournamentId } },
    include: { group: true },
  });

  // Group memberships by group
  const groupMap = new Map<string, string[]>();
  for (const m of memberships) {
    const existing = groupMap.get(m.groupId) || [];
    existing.push(m.userId);
    groupMap.set(m.groupId, existing);
  }

  // For each group, compute ranking and notify changes
  for (const [groupId, groupUserIds] of groupMap) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) continue;

    // Get all members
    const allMembers = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    // Get total points for each member
    const pointsAgg = await prisma.prediction.groupBy({
      by: ["userId"],
      where: {
        userId: { in: allMembers.map((m) => m.userId) },
        match: { tournamentId },
      },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
    });

    // Notify affected users of their position
    for (let i = 0; i < pointsAgg.length; i++) {
      const entry = pointsAgg[i];
      if (groupUserIds.includes(entry.userId)) {
        const position = i + 1;
        if (position <= 3) {
          await createNotification({
            userId: entry.userId,
            type: "rank_up",
            title: `Estas #${position} en ${group.name}!`,
            body: `Con ${entry._sum.points || 0} puntos. Segui asi!`,
            icon: "📈",
          });
        }
      }
    }
  }
}
