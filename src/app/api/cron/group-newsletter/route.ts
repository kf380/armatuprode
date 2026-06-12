import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateProductionEnv } from "@/lib/env";
import { log, logSettled } from "@/lib/log";
import { Resend } from "resend";
import { prettifyFirstName } from "@/lib/welcome-email";

/**
 * Newsletter semanal. Por cada miembro de un grupo activo, envía un mail
 * con: aciertos de la semana, posición en el grupo, top 3 del grupo,
 * próximo partido del torneo.
 *
 * Cron recomendado cron-job.org: 0 22 * * 0 (domingo 22 UTC = 19hs ARG).
 */
const FROM = "Kevin de Armatuprode <hola@armatuprode.com.ar>";

export async function GET(request: NextRequest) {
  validateProductionEnv();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!cronSecret || !token || token !== cronSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta RESEND_API_KEY" }, { status: 500 });
  }
  const resend = new Resend(apiKey);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const groups = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      tournamentId: true,
      members: { select: { userId: true, user: { select: { id: true, email: true, name: true } } } },
    },
  });

  const sends: Promise<unknown>[] = [];

  for (const g of groups) {
    if (g.members.length < 2) continue;

    const memberIds = g.members.map((m) => m.userId);

    // Aggregate points per user (all-time within the tournament for ranking).
    const totals = await prisma.prediction.groupBy({
      by: ["userId"],
      where: { userId: { in: memberIds }, match: { tournamentId: g.tournamentId } },
      _sum: { points: true },
    });
    const totalByUser = new Map(totals.map((t) => [t.userId, t._sum.points ?? 0]));

    // Sorted ranking for the group.
    const ranking = g.members
      .map((m) => ({ userId: m.userId, name: m.user?.name ?? "Jugador", points: totalByUser.get(m.userId) ?? 0 }))
      .sort((a, b) => b.points - a.points);

    // Weekly aggregates per member.
    const weekly = await prisma.prediction.groupBy({
      by: ["userId"],
      where: {
        userId: { in: memberIds },
        match: { tournamentId: g.tournamentId, status: "FINISHED", matchDate: { gte: sevenDaysAgo } },
      },
      _sum: { points: true },
      _count: true,
    });
    const weeklyByUser = new Map(weekly.map((w) => [w.userId, { points: w._sum.points ?? 0, count: w._count }]));

    // Next upcoming match for the tournament.
    const nextMatch = await prisma.match.findFirst({
      where: { tournamentId: g.tournamentId, status: "UPCOMING", matchDate: { gte: now } },
      orderBy: { matchDate: "asc" },
      select: { teamAName: true, teamBName: true, matchDate: true },
    });

    const top3Text = ranking
      .slice(0, 3)
      .map((r, i) => `${["🥇", "🥈", "🥉"][i]} ${r.name} — ${r.points} pts`)
      .join("\n");

    for (const m of g.members) {
      if (!m.user?.email) continue;
      const myRank = ranking.findIndex((r) => r.userId === m.userId) + 1;
      const w = weeklyByUser.get(m.userId);
      const wPts = w?.points ?? 0;
      const wCount = w?.count ?? 0;
      const greeting = prettifyFirstName(m.user.name);
      const arDate = nextMatch
        ? nextMatch.matchDate.toLocaleString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;

      const text = `Hola ${greeting},

Resumen semanal de "${g.name}":

Esta semana cargaste ${wCount} pronóstico${wCount === 1 ? "" : "s"} y sumaste ${wPts} pts.
Estás #${myRank} en el ranking del grupo.

Top 3 del grupo:
${top3Text}
${nextMatch ? `\nPróximo partido: ${nextMatch.teamAName} vs ${nextMatch.teamBName} (${arDate}).\n` : ""}
Entrá a https://armatuprode.com.ar para cargar tu próximo pronóstico.

Kevin`;

      sends.push(
        resend.emails.send({
          from: FROM,
          to: m.user.email,
          subject: `${greeting}, tu semana en ${g.name}`,
          text,
        }),
      );
    }
  }

  log("info", "group_newsletter_fanout", { recipients: sends.length });
  await logSettled("group_newsletter_failed", {}, sends);

  return NextResponse.json({ ok: true, sent: sends.length });
}
