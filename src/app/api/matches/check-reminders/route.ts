import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { log, logSettled } from "@/lib/log";
import { validateProductionEnv } from "@/lib/env";

const PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
  validateProductionEnv();
  // Auth: require CRON_SECRET (no longer falls back to ADMIN_API_KEY)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (
    !cronSecret ||
    !token ||
    token.length !== cronSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const start = Date.now();
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

  let totalNotified = 0;

  for (const match of matches) {
    // Only candidates: users in groups for this tournament who DIDN'T predict yet.
    const memberships = await prisma.groupMember.findMany({
      where: { group: { tournamentId: match.tournamentId } },
      select: { userId: true },
    });
    const candidateIds = Array.from(new Set(memberships.map((m) => m.userId)));

    const predicted = await prisma.prediction.findMany({
      where: { matchId: match.id, userId: { in: candidateIds } },
      select: { userId: true },
    });
    const predictedSet = new Set(predicted.map((p) => p.userId));
    const targets = candidateIds.filter((id) => !predictedSet.has(id));

    // Process in chunks so we don't fire 5000 inserts in parallel and exhaust the pool.
    let notifiedForMatch = 0;
    for (let i = 0; i < targets.length; i += PAGE_SIZE) {
      const chunk = targets.slice(i, i + PAGE_SIZE);
      const promises = chunk.map((userId) =>
        createNotification({
          userId,
          type: "reminder",
          title: "Partido en 1 hora!",
          body: `${match.teamAName} vs ${match.teamBName} empieza pronto. Ya predijiste?`,
          icon: "⚽",
        }),
      );
      const results = await logSettled(
        "check_reminders_notify_chunk_failed",
        { matchId: match.id, chunkStart: i, chunkSize: chunk.length },
        promises,
      );
      notifiedForMatch += results.filter((r) => r.status === "fulfilled").length;
    }

    await prisma.match.update({
      where: { id: match.id },
      data: { reminderSent: true },
    });

    totalNotified += notifiedForMatch;
    log("info", "check_reminders_match_done", {
      matchId: match.id,
      candidates: candidateIds.length,
      targets: targets.length,
      notified: notifiedForMatch,
    });
  }

  const durationMs = Date.now() - start;
  log("info", "check_reminders_done", {
    matches: matches.length,
    notified: totalNotified,
    durationMs,
  });

  return NextResponse.json({ matches: matches.length, notified: totalNotified, durationMs });
}
