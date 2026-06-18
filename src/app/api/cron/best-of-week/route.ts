import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { validateProductionEnv } from "@/lib/env";
import { log, logSettled } from "@/lib/log";

/**
 * Domingo a la noche: por cada user con grupo, le manda push con su
 * mejor predicción de la semana (últimos 7 días). Si no tuvo aciertos,
 * lo saltea.
 *
 * Cron schedule recomendado en cron-job.org: 0 0 * * 0 (medianoche dom UTC).
 * Auth: header Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  validateProductionEnv();
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

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  // For each user with predictions in the last 7 days where they scored
  // points, find their best one.
  const userIds = await prisma.user.findMany({
    where: {
      predictions: {
        some: {
          points: { gt: 0 },
          match: { status: "FINISHED", matchDate: { gte: sevenDaysAgo } },
        },
      },
      pushSubscriptions: { some: {} },
      memberships: { some: {} },
    },
    select: { id: true },
  });

  const { sendPushToUser } = await import("@/lib/push");
  const sends: Promise<unknown>[] = [];

  for (const u of userIds) {
    const best = await prisma.prediction.findFirst({
      where: {
        userId: u.id,
        points: { gt: 0 },
        match: { status: "FINISHED", matchDate: { gte: sevenDaysAgo } },
      },
      orderBy: [{ points: "desc" }, { match: { matchDate: "desc" } }],
      include: { match: { select: { teamAName: true, teamBName: true, scoreA: true, scoreB: true } } },
    });
    if (!best || !best.match) continue;

    const m = best.match;
    const verdict =
      best.scoreA === m.scoreA && best.scoreB === m.scoreB
        ? "exacto"
        : "ganador";
    const title = `📈 Tu semana en Armatuprode`;
    const body = `Tu mejor pronóstico: ${m.teamAName} ${best.scoreA}-${best.scoreB} ${m.teamBName} (${verdict}, +${best.points} pts).`;
    sends.push(sendPushToUser(u.id, title, body));
  }

  log("info", "best_of_week_fanout", { recipients: sends.length });
  await logSettled("best_of_week_push_failed", {}, sends);

  return NextResponse.json({ ok: true, recipients: sends.length });
}
