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
  "united states": "usa",
  "ir iran": "iran",
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
  const windowStart = new Date(today.getTime() - daysBack * 86_400_000);
  const windowEnd = new Date(today.getTime() + daysForward * 86_400_000);
  const dateFrom = windowStart.toISOString().slice(0, 10);
  const dateTo = windowEnd.toISOString().slice(0, 10);

  // Fetch football-data.org + all DB matches for the window in parallel.
  const [fdResp, dbMatches] = await Promise.all([
    fetch(`${FD_URL}?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
      headers: { "X-Auth-Token": fdToken },
    }),
    prisma.match.findMany({
      where: { matchDate: { gte: windowStart, lte: windowEnd } },
      select: { id: true, teamAName: true, teamBName: true, status: true, matchDate: true },
    }),
  ]);

  const quotaLeftMinute = fdResp.headers.get("x-requests-available-minute");

  if (!fdResp.ok) {
    if (closePrismaOnExit) await prisma.$disconnect();
    throw new Error(`football-data.org HTTP ${fdResp.status}`);
  }

  const fdData = (await fdResp.json()) as { matches: FdMatch[] };

  // Build a lookup map keyed by "YYYY-MM-DD|normA|normB" for O(1) matching.
  const dbByKey = new Map<string, typeof dbMatches[number]>();
  for (const m of dbMatches) {
    const d = m.matchDate.toISOString().slice(0, 10);
    const na = normalize(m.teamAName);
    const nb = normalize(m.teamBName);
    dbByKey.set(`${d}|${na}|${nb}`, m);
    dbByKey.set(`${d}|${nb}|${na}`, m); // bidirectional
  }

  const summary: SyncSummary = {
    finished: 0,
    live: 0,
    skipped: 0,
    unmatched: 0,
    failed: 0,
    quotaLeftMinute,
    details: [],
  };

  // Collect all HTTP actions to fire in parallel after the loop.
  type PendingAction = {
    label: string;
    kind: "finish" | "live";
    url: string;
    body: Record<string, unknown>;
  };
  const pending: PendingAction[] = [];

  for (const fd of fdData.matches) {
    const label = `${fd.homeTeam.name} vs ${fd.awayTeam.name}`;
    const sa = fd.score.fullTime.home;
    const sb = fd.score.fullTime.away;

    const fdDate = new Date(fd.utcDate);
    const dateKey = fdDate.toISOString().slice(0, 10);
    const homeNorm = normalize(fd.homeTeam.name);
    const awayNorm = normalize(fd.awayTeam.name);

    const dbMatch = dbByKey.get(`${dateKey}|${homeNorm}|${awayNorm}`);

    if (!dbMatch) {
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
      pending.push({
        label,
        kind: "finish",
        url: `${baseUrl}/api/matches/${dbMatch.id}/finish`,
        body: { scoreA: sa, scoreB: sb },
      });
      continue;
    }

    if (fd.status === "IN_PLAY" || fd.status === "PAUSED") {
      if (dbMatch.status === "FINISHED") {
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
      pending.push({
        label,
        kind: "live",
        url: `${baseUrl}/api/matches/${dbMatch.id}/update-live`,
        body: { scoreA: updateScoreA, scoreB: updateScoreB, minute, period },
      });
    }
  }

  // Fire all HTTP updates in parallel.
  if (pending.length > 0) {
    const results = await Promise.allSettled(
      pending.map((p) =>
        fetch(p.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}` },
          body: JSON.stringify(p.body),
        }),
      ),
    );
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const r = results[i];
      if (r.status === "fulfilled" && r.value.ok) {
        if (p.kind === "finish") {
          summary.finished++;
          const { scoreA, scoreB } = p.body as { scoreA: number; scoreB: number };
          summary.details.push({ match: p.label, action: "finish", reason: `${scoreA}-${scoreB}` });
        } else {
          summary.live++;
          const { scoreA, scoreB, minute } = p.body as { scoreA: number; scoreB: number; minute: number | null };
          summary.details.push({ match: p.label, action: "live", reason: `${scoreA}-${scoreB} ${minute ?? "-"}'` });
        }
      } else {
        summary.failed++;
        const reason = r.status === "rejected"
          ? String(r.reason)
          : `${p.kind} HTTP ${r.value.status}`;
        summary.details.push({ match: p.label, action: "fail", reason });
      }
    }
  }

  if (closePrismaOnExit) await prisma.$disconnect();
  return summary;
}
