/**
 * Sync match results from football-data.org → armatuprode DB.
 *
 *   npx tsx scripts/sync-results.ts             # dry-run (preview cambios)
 *   npx tsx scripts/sync-results.ts --apply     # postea a /api/matches/[id]/finish
 *
 * Requiere en .env.local:
 *   FOOTBALL_DATA_TOKEN   token de football-data.org
 *   ADMIN_API_KEY         clave admin del backend (igual a la de Vercel prod)
 *   ARMATUPRODE_BASE_URL  default = https://armatuprode.com.ar
 *
 * Diseño: idempotente. El endpoint /finish hace two-phase lock, así que un
 * mismo match no se procesa dos veces aunque el cron lo dispare cada 5 min.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN!;
const ADMIN_KEY = process.env.ADMIN_API_KEY!;
const BASE_URL = process.env.ARMATUPRODE_BASE_URL ?? "https://armatuprode.com.ar";
const FD_URL = "https://api.football-data.org/v4/competitions/WC/matches";

type FdMatch = {
  id: number;
  utcDate: string;
  status: "FINISHED" | "IN_PLAY" | "PAUSED" | "TIMED" | "SCHEDULED" | "POSTPONED" | "CANCELLED";
  homeTeam: { name: string; shortName: string };
  awayTeam: { name: string; shortName: string };
  score: { fullTime: { home: number | null; away: number | null } };
};

const prisma = new PrismaClient();

// Conservative aliases. Names that differ between FIFA and football-data.org.
// Extend as new mismatches show up (script logs them).
const NAME_ALIASES: Record<string, string> = {
  "czechia": "czech republic",
  "korea republic": "south korea",
  "iran": "iran",
};

function normalize(s: string): string {
  const lower = s.trim().toLowerCase();
  return NAME_ALIASES[lower] ?? lower;
}

async function main() {
  const live = process.argv.includes("--apply");

  if (!FD_TOKEN) {
    console.error("Falta FOOTBALL_DATA_TOKEN en .env.local");
    process.exit(1);
  }
  if (live && !ADMIN_KEY) {
    console.error("Falta ADMIN_API_KEY en .env.local (necesario para --apply)");
    process.exit(1);
  }

  // Pull last 2 days + next 1 day. Keep range small to respect 10 req/min.
  const today = new Date();
  const dateFrom = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateTo = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const fdResp = await fetch(`${FD_URL}?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: { "X-Auth-Token": FD_TOKEN },
  });

  if (!fdResp.ok) {
    console.error("football-data.org HTTP", fdResp.status, await fdResp.text());
    process.exit(1);
  }

  const remaining = fdResp.headers.get("x-requests-available-minute");
  if (remaining) console.log(`(quota restante este minuto: ${remaining})`);

  const fdData = (await fdResp.json()) as { matches: FdMatch[] };
  const finished = fdData.matches.filter((m) => m.status === "FINISHED");
  console.log(`\nMatches FINISHED en la ventana ${dateFrom} → ${dateTo}: ${finished.length}`);

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;
  let failed = 0;

  for (const fd of finished) {
    const sa = fd.score.fullTime.home;
    const sb = fd.score.fullTime.away;
    if (sa == null || sb == null) {
      console.log(`  skip (sin score): ${fd.homeTeam.name} vs ${fd.awayTeam.name}`);
      skipped++;
      continue;
    }

    // Match by date (calendar day UTC) + normalized team names. Robust to
    // FIFA vs football-data naming differences via NAME_ALIASES.
    const homeNorm = normalize(fd.homeTeam.name);
    const awayNorm = normalize(fd.awayTeam.name);
    const fdDate = new Date(fd.utcDate);
    const dayStart = new Date(Date.UTC(fdDate.getUTCFullYear(), fdDate.getUTCMonth(), fdDate.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const candidates = await prisma.match.findMany({
      where: { matchDate: { gte: dayStart, lt: dayEnd } },
      select: { id: true, teamAName: true, teamBName: true, status: true },
    });

    const dbMatch = candidates.find(
      (c) => normalize(c.teamAName) === homeNorm && normalize(c.teamBName) === awayNorm,
    );

    if (!dbMatch) {
      console.log(`  ⚠ unmatched: ${fd.homeTeam.name} vs ${fd.awayTeam.name} (${fd.utcDate.slice(0, 10)})`);
      unmatched++;
      continue;
    }

    if (dbMatch.status === "FINISHED") {
      skipped++;
      continue;
    }

    if (!live) {
      console.log(`  DRY ${fd.homeTeam.name} ${sa}-${sb} ${fd.awayTeam.name}  → match ${dbMatch.id.slice(0, 8)}…`);
      updated++;
      continue;
    }

    const resp = await fetch(`${BASE_URL}/api/matches/${dbMatch.id}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_KEY}`,
      },
      body: JSON.stringify({ scoreA: sa, scoreB: sb }),
    });

    if (resp.ok) {
      console.log(`  ✓ ${fd.homeTeam.name} ${sa}-${sb} ${fd.awayTeam.name}`);
      updated++;
    } else {
      console.error(`  ✗ HTTP ${resp.status} ${fd.homeTeam.name} vs ${fd.awayTeam.name}:`, await resp.text());
      failed++;
    }
  }

  console.log(`\nResumen: ${updated} updated · ${skipped} skipped · ${unmatched} unmatched · ${failed} failed`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
