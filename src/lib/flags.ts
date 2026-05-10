/**
 * Release feature flags. All flags are env-driven and fail-closed in production:
 * if a money-handling flag is missing or unset, it is treated as OFF.
 *
 * Read these at request time, not at module load, so flips don't require a redeploy.
 */

function envBool(key: string, defaultValue: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return defaultValue;
  const norm = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(norm)) return true;
  if (["0", "false", "no", "off"].includes(norm)) return false;
  return defaultValue;
}

function envEnum<T extends string>(key: string, allowed: readonly T[], def: T): T {
  const v = process.env[key];
  if (!v) return def;
  return (allowed as readonly string[]).includes(v) ? (v as T) : def;
}

const isProd = () => process.env.NODE_ENV === "production";

export const flags = {
  /** Real-money pool entries (legacy POOL_ENTRY flow). Default OFF in prod. */
  enableRealMoneyPools: () => envBool("ENABLE_REAL_MONEY_POOLS", !isProd()),
  /** Coin shop (in-app coin pack purchases via MP). Default OFF in prod. */
  enableCoinShop: () => envBool("ENABLE_COIN_SHOP", !isProd()),
  /** Premium tournaments — placeholder for future paid private tournaments. Default OFF. */
  enablePremiumTournaments: () => envBool("ENABLE_PREMIUM_TOURNAMENTS", false),
  /** Manual prizes (operator-distributed). Default ON for controlled launch. */
  enableManualPrizes: () => envBool("ENABLE_MANUAL_PRIZES", true),
  /** Public launch mode: closed | controlled | open. Default controlled. */
  publicLaunchMode: () =>
    envEnum("PUBLIC_LAUNCH_MODE", ["closed", "controlled", "open"] as const, "controlled"),

  // --- B2B evolution flags ---
  /** B2B organizations (orgs + premium plans). Default ON. */
  enableB2bOrganizers: () => envBool("ENABLE_B2B_ORGANIZERS", true),
  /** Personal groups (free + PERSONAL_PLUS). Default ON. */
  enablePersonalGroups: () => envBool("ENABLE_PERSONAL_GROUPS", true),
  /** Organization plans (COMMUNITY/BUSINESS). Default ON. */
  enableOrganizationPlans: () => envBool("ENABLE_ORGANIZATION_PLANS", true),

  // --- Hard-gated flags (default OFF, never auto-enabled) ---
  /** Players paying entry fees individually. Default OFF. */
  enablePlayerPayments: () => envBool("ENABLE_PLAYER_PAYMENTS", false),
  /** Legal sign-off that real-money pools are approved by counsel/regulator. */
  legalRealMoneyPoolsApproved: () => envBool("LEGAL_REAL_MONEY_POOLS_APPROVED", false),

  // --- Phase 2: Manual Pool (Versión B) ---
  /**
   * Manual pool informational mode. When ON:
   *  - wizard exposes "¿hay pozo?" step
   *  - PATCH/POST groups accepts moneyMode=MANUAL_POOL + declaredPoolEntry
   *  - billing uses priceForPool(declared) instead of plan flat/per-player
   *  - JoinGroupScreen shows declared pool to invitees
   * The platform NEVER touches the pool money — only registers tracking
   * and charges the organizer the SaaS fee. Default OFF until UI ships in
   * Sprint 2.
   */
  enableManualPools: () => envBool("ENABLE_MANUAL_POOLS", false),

  // --- Phase 2c: Player Premium (B2C paywall voluntario) ---
  /**
   * Player premium: cada jugador puede pagar USD 2 (default) por torneo
   * para desbloquear features extras (insights, badge, etc). Default OFF.
   * NO es apuesta — es paywall de software, igual que Spotify/Netflix.
   */
  enablePlayerPremium: () => envBool("ENABLE_PLAYER_PREMIUM", false),
};

/**
 * Triple gate for individual player payments. Returns true ONLY if all three
 * orthogonal flags are explicitly enabled. Use at any handler that would
 * accept a per-player entry fee.
 */
export function canPlayersBeCharged(): boolean {
  return (
    flags.enableRealMoneyPools() &&
    flags.enablePlayerPayments() &&
    flags.legalRealMoneyPoolsApproved()
  );
}

export type FeatureFlag = keyof Omit<typeof flags, "publicLaunchMode">;
