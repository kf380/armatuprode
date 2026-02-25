import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  // Auth: require CRON_SECRET or ADMIN_API_KEY
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const adminKey = process.env.ADMIN_API_KEY;
  const token = authHeader?.replace("Bearer ", "");
  if (!token || (token !== cronSecret && token !== adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  // Find matches starting in < 1 hour that haven't sent reminders
  const matches = await prisma.match.findMany({
    where: {
      status: "UPCOMING",
      reminderSent: false,
      matchDate: { gte: now, lte: oneHourFromNow },
    },
  });

  let notified = 0;

  for (const match of matches) {
    // Find users who haven't predicted this match yet
    const allUsers = await prisma.user.findMany({ select: { id: true } });
    const predictedUserIds = await prisma.prediction.findMany({
      where: { matchId: match.id },
      select: { userId: true },
    });
    const predictedSet = new Set(predictedUserIds.map((p) => p.userId));

    for (const user of allUsers) {
      if (!predictedSet.has(user.id)) {
        await createNotification({
          userId: user.id,
          type: "reminder",
          title: "Partido en 1 hora!",
          body: `${match.teamAName} vs ${match.teamBName} empieza pronto. Ya predijiste?`,
          icon: "⚽",
        });
        notified++;
      }
    }

    await prisma.match.update({
      where: { id: match.id },
      data: { reminderSent: true },
    });
  }

  return NextResponse.json({ matches: matches.length, notified });
}
