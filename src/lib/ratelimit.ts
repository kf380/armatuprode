import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { log } from "@/lib/log";

/**
 * Sliding-window rate limiting backed by Upstash Redis.
 *
 * If `UPSTASH_REDIS_REST_URL` is not configured (e.g. local dev), the limiters
 * become no-ops so the app continues to work. In production, configure the
 * Upstash env vars; otherwise rate limiting silently degrades.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

// Visible warning in production: rate limiting is silently no-op without Upstash.
// We log once at module load so ops can spot it in deployment logs.
if (!redis && process.env.NODE_ENV === "production") {
  log("warn", "ratelimit_disabled_in_production", {
    reason: "missing UPSTASH_REDIS_REST_URL/TOKEN",
    impact: "all rate limiters are no-op; abuse protection disabled",
  });
}

function makeLimiter(prefix: string, limit: number, windowSec: number): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `armatuprode:rl:${prefix}`,
    analytics: false,
  });
}

// Per-route limiters tuned conservatively; tighten/loosen based on real usage.
const limiters = {
  // Auth-bound endpoints (per-user). Reasonable cap so a logged-in user can't
  // flood the prediction or signup pipeline.
  predictions: makeLimiter("pred", 30, 60),       // 30 req/min per user
  paymentsCreate: makeLimiter("paycreate", 10, 60), // 10 MP preferences/min
  usersWrite: makeLimiter("userwrite", 5, 60),    // 5 signups/min per identity
  // Per-IP for unauthenticated or shared paths.
  webhookByIp: makeLimiter("mpwebhook", 120, 60), // 120 req/min per IP
  // Per-key for admin endpoints.
  adminByKey: makeLimiter("admin", 60, 60),       // 60 req/min per admin key
};

export type LimiterKey = keyof typeof limiters;

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Apply a named limiter to an identifier (user id, IP, hash of admin key, etc).
 * Returns ok=true when no Upstash configured (dev/no-op).
 */
export async function rateLimit(name: LimiterKey, identifier: string): Promise<RateLimitResult> {
  const limiter = limiters[name];
  if (!limiter) {
    return { ok: true, limit: -1, remaining: -1, reset: 0 };
  }
  try {
    const r = await limiter.limit(identifier);
    return { ok: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
  } catch (err) {
    // Fail-open: don't lock users out when Redis is down. Log severe.
    log("error", "ratelimit_redis_error", { name, identifier, err: String(err) });
    return { ok: true, limit: -1, remaining: -1, reset: 0 };
  }
}

/**
 * Best-effort client IP extraction from headers set by Vercel / common proxies.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Stable, non-reversible identifier for an admin secret. We never want raw
 * secrets sitting in Redis keys, so we use a SHA-256 hex prefix.
 */
export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex").slice(0, 16);
}
