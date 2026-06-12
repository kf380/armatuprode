/**
 * CLI wrapper sobre syncFootballData().
 *
 *   npx tsx scripts/sync-results.ts             # dry-run
 *   npx tsx scripts/sync-results.ts --apply     # postea a /finish + /update-live
 *
 * Variables en .env.local:
 *   FOOTBALL_DATA_TOKEN, ADMIN_API_KEY, ARMATUPRODE_BASE_URL (opt)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { syncFootballData } from "../src/lib/sync-football-data";

async function main() {
  const apply = process.argv.includes("--apply");
  const baseUrl = process.env.ARMATUPRODE_BASE_URL ?? "https://armatuprode.com.ar";
  const fdToken = process.env.FOOTBALL_DATA_TOKEN;
  const adminKey = process.env.ADMIN_API_KEY;

  if (!fdToken) {
    console.error("Falta FOOTBALL_DATA_TOKEN en .env.local");
    process.exit(1);
  }
  if (apply && !adminKey) {
    console.error("Falta ADMIN_API_KEY en .env.local (necesario para --apply)");
    process.exit(1);
  }

  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  const summary = await syncFootballData({ apply, baseUrl, adminKey: adminKey ?? "", fdToken });

  if (summary.quotaLeftMinute) {
    console.log(`(quota restante este minuto: ${summary.quotaLeftMinute})`);
  }
  for (const d of summary.details) {
    const tag = d.action.padEnd(9);
    console.log(`  ${tag}${d.match}${d.reason ? "  → " + d.reason : ""}`);
  }
  console.log(`\nResumen: ${summary.finished} finished · ${summary.live} live · ${summary.skipped} skipped · ${summary.unmatched} unmatched · ${summary.failed} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
