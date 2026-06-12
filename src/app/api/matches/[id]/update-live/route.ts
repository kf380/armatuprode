import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, hashSecret } from "@/lib/ratelimit";
import { adminKeyFromRequest, isValidAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { log, logSettled } from "@/lib/log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminKey = adminKeyFromRequest(request);
  if (!isValidAdmin(adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const adminRl = await rateLimit("adminByKey", hashSecret(adminKey!));
  if (!adminRl.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  const body = await request.json();
  const { scoreA, scoreB, minute, period } = body;

  const { id } = await params;

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (match.status === "FINISHED") {
    return NextResponse.json({ error: "Partido ya finalizado, no se puede volver a LIVE" }, { status: 409 });
  }

  const prevScoreA = match.scoreA ?? 0;
  const prevScoreB = match.scoreB ?? 0;
  const newScoreA = scoreA ?? match.scoreA ?? 0;
  const newScoreB = scoreB ?? match.scoreB ?? 0;
  const golScoredBy: "A" | "B" | null =
    newScoreA > prevScoreA ? "A" : newScoreB > prevScoreB ? "B" : null;

  // Update to LIVE status with current scores and optional minute/period
  await prisma.match.update({
    where: { id },
    data: {
      status: "LIVE",
      scoreA: newScoreA,
      scoreB: newScoreB,
      ...(minute != null ? { minute } : {}),
      ...(period ? { period } : {}),
    },
  });

  await logAdminAction(request, "update_live", adminKey, {
    matchId: id,
    scoreA: scoreA ?? null,
    scoreB: scoreB ?? null,
    minute: minute ?? null,
    period: period ?? null,
  });

  // Push notif on GOL — best effort, must not block the response.
  // Only users that belong to a group in this tournament get notified
  // (no spam to users that haven't joined any group of this competition).
  if (golScoredBy) {
    try {
      const scoringTeam = golScoredBy === "A" ? match.teamAName : match.teamBName;
      const title = `⚽ GOL — ${scoringTeam}`;
      const minuteSuffix = minute != null ? ` (${minute}')` : "";
      const body = `${match.teamAName} ${newScoreA} - ${newScoreB} ${match.teamBName}${minuteSuffix}`;

      const subscribers = await prisma.user.findMany({
        where: {
          memberships: { some: { group: { tournamentId: match.tournamentId } } },
          pushSubscriptions: { some: {} },
        },
        select: { id: true },
      });

      log("info", "match_gol_push_fanout", { matchId: id, recipients: subscribers.length });
      const { sendPushToUser } = await import("@/lib/push");
      await logSettled(
        "match_gol_push_failed",
        { matchId: id },
        subscribers.map((u) => sendPushToUser(u.id, title, body)),
      );
    } catch (e) {
      log("warn", "match_gol_push_dispatch_failed", { matchId: id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, matchId: id, gol: !!golScoredBy });
}
