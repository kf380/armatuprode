/**
 * Sync match results & live scores from football-data.org → armatuprode.
 *
 * Used by both the CLI script (scripts/sync-results.ts) and the Vercel cron
 * endpoint (/api/cron/sync-results). Posts to /finish or /update-live via HTTP
 * to reuse the full scoring + side-effects path that the admin panel uses.
 *
 * Always idempotent: /finish does two-phase lock so re-runs are safe.
 */
import { PrismaClient } from "@prisma/client";

const FD_URL = "https://api.football-data.org/v4/competitions/WC/matches";

type FdStatus =
  | "FINISHED"
  | "IN_PLAY"
  | "PAUSED"
  | "TIMED"
  | "SCHEDULED"
  | "POSTPONED"
  | "CANCELLED";

type FdMatch = {
  id: number;
  utcDate: string;
  status: FdStatus;
  minute?: number | null;
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
  score: { fullTime: { home: number | null; away: number | null } };
};

export type SyncSummary = {
  finished: number;
  live: number;
  skipped: number;
  unmatched: number;
  failed: number;
  quotaLeftMinute: string | null;
  details: Array<{ match: string; action: "finish" | "live" | "skip" | "unmatched" | "fail"; reason?: string }>;
};

// Aliases for name mismatches between FIFA and football-data.org. Extend
// as new mismatches appear in logs.
const NAME_ALIASES: Record<string, string> = {
  "czechia": "czech republic",
  "korea republic": "south korea",
  "bosnia herzegovina": "bosnia herz",
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    // collapse separators (&, -, .) y espacios múltiples → single space
    .replace(/[&\-.,/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // run aliases AFTER cleanup so 'bosnia-herzegovina' → 'bosnia herzegovina' → 'bosnia herz'
    .replace(/^(.+)$/, (match) => NAME_ALIASES[match] ?? match);
}

export type SyncOptions = {
  apply: boolean;
  baseUrl: string;
  adminKey: string;
  fdToken: string;
  // Window in days back from today (default 2). Forward 1 day to catch matches
  // that just kicked off.
  daysBack?: number;
  daysForward?: number;
  prisma?: PrismaClient;
};

export async function syncFootballData(opts: SyncOptions): Promise<SyncSummary> {
  const {
    apply,
    baseUrl,
    adminKey,
    fdToken,
    daysBack = 2,
    daysForward = 1,
  } = opts;
  const prisma = opts.prisma ?? new PrismaClient();
  const closePrismaOnExit = !opts.prisma;

  const today = new Date();
  const dateFrom = new Date(today.getTime() - daysBack * 86_400_000).toISOString().slice(0, 10);
  const dateTo = new Date(today.getTime() + daysForward * 86_400_000).toISOString().slice(0, 10);

  const fdResp = await fetch(`${FD_URL}?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { "X-Auth-Token": fdToken },
  });
  const quotaLeftMinute = fdResp.headers.get("x-requests-available-minute");

  if (!fdResp.ok) {
    if (closePrismaOnExit) await prisma.$disconnect();
    throw new Error(`football-data.org HTTP ${fdResp.status}`);
  }

  const fdData = (await fdResp.json()) as { matches: FdMatch[] };

  const summary: SyncSummary = {
    finished: 0,
    live: 0,
    skipped: 0,
    unmatched: 0,
    failed: 0,
    quotaLeftMinute,
    details: [],
  };

  for (const fd of fdData.matches) {
    const label = `${fd.homeTeam.name} vs ${fd.awayTeam.name}`;
    const sa = fd.score.fullTime.home;
    const sb = fd.score.fullTime.away;

    // Match by date (UTC calendar day) + normalized team names.
    const homeNorm = normalize(fd.homeTeam.name);
    const awayNorm = normalize(fd.awayTeam.name);
    const fdDate = new Date(fd.utcDate);
    const dayStart = new Date(Date.UTC(fdDate.getUTCFullYear(), fdDate.getUTCMonth(), fdDate.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);

    const candidates = await prisma.match.findMany({
      where: { matchDate: { gte: dayStart, lt: dayEnd } },
      select: { id: true, teamAName: true, teamBName: true, status: true },
    });
    const dbMatch = candidates.find(
      (c) => normalize(c.teamAName) === homeNorm && normalize(c.teamBName) === awayNorm,
    );

    if (!dbMatch) {
      // Only flag as unmatched for active states; TIMED far-future matches
      // are expected to have no counterpart yet during cron sweeps.
      if (fd.status === "FINISHED" || fd.status === "IN_PLAY" || fd.status === "PAUSED") {
        summary.unmatched++;
        summary.details.push({ match: label, action: "unmatched" });
      }
      continue;
    }

    if (fd.status === "FINISHED") {
      if (sa == null || sb == null) {
        summary.skipped++;
        summary.details.push({ match: label, action: "skip", reason: "no_score" });
        continue;
      }
      if (dbMatch.status === "FINISHED") {
        summary.skipped++;
        continue;
      }
      if (!apply) {
        summary.finished++;
        summary.details.push({ match: label, action: "finish", reason: `dry ${sa}-${sb}` });
        continue;
      }
      const resp = await fetch(`${baseUrl}/api/matches/${dbMatch.id}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ scoreA: sa, scoreB: sb }),
      });
      if (resp.ok) {
        summary.finished++;
        summary.details.push({ match: label, action: "finish", reason: `${sa}-${sb}` });
      } else {
        summary.failed++;
        summary.details.push({ match: label, action: "fail", reason: `finish HTTP ${resp.status}` });
      }
      continue;
    }

    if (fd.status === "IN_PLAY" || fd.status === "PAUSED") {
      if (dbMatch.status === "FINISHED") {
        // Already finished locally; don't reopen.
        summary.skipped++;
        continue;
      }
      const updateScoreA = sa ?? 0;
      const updateScoreB = sb ?? 0;
      const minute = fd.minute ?? null;
      const period = fd.status === "PAUSED" ? "HT" : "1H";

      if (!apply) {
        summary.live++;
        summary.details.push({ match: label, action: "live", reason: `dry ${updateScoreA}-${updateScoreB} ${minute ?? "-"}'` });
        continue;
      }
      const resp = await fetch(`${baseUrl}/api/matches/${dbMatch.id}/update-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
        body: JSON.stringify({ scoreA: updateScoreA, scoreB: updateScoreB, minute, period }),
      });
      if (resp.ok) {
        summary.live++;
        summary.details.push({ match: label, action: "live", reason: `${updateScoreA}-${updateScoreB} ${minute ?? "-"}'` });
      } else {
        summary.failed++;
        summary.details.push({ match: label, action: "fail", reason: `live HTTP ${resp.status}` });
      }
    }
  }

  if (closePrismaOnExit) await prisma.$disconnect();
  return summary;
}
