/**
 * Centralized environment variable validation.
 * Production-only checks for secrets that, if missing, would silently degrade security.
 */

const REQUIRED_IN_PROD = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "MERCADOPAGO_ACCESS_TOKEN",
  "MP_WEBHOOK_SECRET",
  "ADMIN_API_KEY",
  "CRON_SECRET",
] as const;

export type RequiredEnvKey = (typeof REQUIRED_IN_PROD)[number];

let validated = false;

/** Optional vars whose absence degrades safety but doesn't refuse boot. */
const RECOMMENDED_IN_PROD = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;

/**
 * Validates that all required env vars exist in production.
 * Throws on first missing var. Idempotent — safe to call from many handlers.
 * Pass `force: true` to re-validate (used in tests).
 */
export function validateProductionEnv(force = false): void {
  if (validated && !force) return;
  if (process.env.NODE_ENV !== "production") {
    validated = true;
    return;
  }
  const missing = REQUIRED_IN_PROD.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production env vars: ${missing.join(", ")}. ` +
        `Refusing to boot. Configure them in your hosting provider before deploying.`,
    );
  }
  // Soft warning for recommended vars
  const missingSoft = RECOMMENDED_IN_PROD.filter((k) => !process.env[k]);
  if (missingSoft.length > 0) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "production_recommended_env_missing",
        missing: missingSoft,
        impact: "rate limiting is no-op without Upstash",
        ts: new Date().toISOString(),
      }),
    );
  }
  validated = true;
}

/**
 * Strict per-call check for a specific secret. Use at the top of handlers
 * that absolutely need a secret (e.g., webhook signature, cron auth).
 * Returns the value or throws.
 */
export function requireEnv(key: RequiredEnvKey): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(`Required env var ${key} is not set`);
  }
  return v;
}
