import { NextResponse } from "next/server";
import { flags } from "@/lib/flags";
import { limits } from "@/lib/limits";

/**
 * Public-safe runtime config. Used by the client to hide UI for disabled features
 * so users don't get surprised by 403s. NEVER expose secrets here.
 */
export async function GET() {
  return NextResponse.json({
    flags: {
      enableRealMoneyPools: flags.enableRealMoneyPools(),
      enableCoinShop: flags.enableCoinShop(),
      enablePremiumTournaments: flags.enablePremiumTournaments(),
      enableManualPrizes: flags.enableManualPrizes(),
      publicLaunchMode: flags.publicLaunchMode(),
      // B2B
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
  });
}
