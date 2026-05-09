/**
 * Operational limits — read from env so ops can tighten/loosen without a deploy.
 * Defaults are conservative for a controlled public launch.
 */

function envInt(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (!v) return defaultValue;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

export const limits = {
  /** Hard cap on total registered users for the controlled launch. */
  maxPublicUsers: () => envInt("MAX_PUBLIC_USERS", 5000),
  /** Cap on members per individual paid pool. */
  maxPoolParticipants: () => envInt("MAX_POOL_PARTICIPANTS", 50),
  /** Max ARS amount allowed per pool entry. Currency-agnostic in code; ARS by convention. */
  maxEntryFee: () => envInt("MAX_ENTRY_FEE", 20000),
  /** Total active paid groups allowed concurrently. */
  maxActivePaidGroups: () => envInt("MAX_ACTIVE_PAID_GROUPS", 50),
};

export type LimitKey = keyof typeof limits;
