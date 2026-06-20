import { NextResponse } from "next/server";
import { flags } from "@/lib/flags";
import { limits } from "@/lib/limits";

// Edge runtime: reads only env vars — no DB, no Prisma, executes in ~30ms vs ~280ms serverless.
export const runtime = "edge";

/**
 * Public-safe runtime config. Used by the client to hide UI for disabled features
 * so users don't get surprised by 403s. NEVER expose secrets here.
 */
export async function GET() {
  return NextResponse.json(
    {
      flags: {
        enableRealMoneyPools: flags.enableRealMoneyPools(),
        enableCoinShop: flags.enableCoinShop(),
        enablePremiumTournaments: flags.enablePremiumTournaments(),
        enableManualPrizes: flags.enableManualPrizes(),
        publicLaunchMode: flags.publicLaunchMode(),
        enableB2bOrganizers: flags.enableB2bOrganizers(),
        enablePersonalGroups: flags.enablePersonalGroups(),
        enableOrganizationPlans: flags.enableOrganizationPlans(),
        enablePlayerPayments: flags.enablePlayerPayments(),
        enableManualPools: flags.enableManualPools(),
      },
      limits: {
        maxPoolParticipants: limits.maxPoolParticipants(),
        maxEntryFee: limits.maxEntryFee(),
      },
    },
    {
      headers: {
        // CDN caches for 5 min, serves stale up to 1h while revalidating.
        // Flags only change on deploy — 5min is safe and eliminates serverless cost per user boot.
        "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
