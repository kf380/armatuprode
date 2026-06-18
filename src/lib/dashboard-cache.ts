/**
 * Server-side cache del dashboard payload usando Upstash Redis.
 * Combinado con el SWR client-side, los hits frecuentes pagan cero DB.
 *
 * TTL corto (30s) porque scores/rankings cambian rápido durante partidos.
 * Si Upstash no está configurado, no-op silencioso → cae al path normal.
 */
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const TTL_SECONDS = 30;
const KEY_PREFIX = "dashboard:v2:"; // v2 si cambiamos shape del payload, invalida en masa

export async function readDashboardCache<T>(userId: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<T>(`${KEY_PREFIX}${userId}`);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function writeDashboardCache<T>(userId: string, data: T): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${KEY_PREFIX}${userId}`, data, { ex: TTL_SECONDS });
  } catch {
    /* swallow — caching is best-effort */
  }
}

export async function invalidateDashboardCache(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`${KEY_PREFIX}${userId}`);
  } catch {
    /* swallow */
  }
}

// ── Ranking cache ──────────────────────────────────────────────────────────
// Ranking changes only when a match finishes (scored by /finish). TTL 60s as
// a safety net; the /finish endpoint calls invalidateRankingCache explicitly.

const RANKING_PREFIX = "ranking:v1:";
const RANKING_TTL = 60;

export async function readRankingCache<T>(tournamentId: string, userId: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(`${RANKING_PREFIX}${tournamentId}:${userId}`) ?? null;
  } catch {
    return null;
  }
}

export async function writeRankingCache<T>(tournamentId: string, userId: string, data: T): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${RANKING_PREFIX}${tournamentId}:${userId}`, data, { ex: RANKING_TTL });
  } catch { /* swallow */ }
}

export async function invalidateRankingCache(tournamentId: string): Promise<void> {
  if (!redis) return;
  try {
    // Delete all per-user keys for this tournament via scan.
    let cursor: string = "0";
    do {
      const [nextCursor, keys]: [string, string[]] = await redis.scan(cursor, { match: `${RANKING_PREFIX}${tournamentId}:*`, count: 100 });
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (String(cursor) !== "0");
  } catch { /* swallow */ }
}

// ── Groups list cache ──────────────────────────────────────────────────────
const GROUPS_PREFIX = "groups:v1:";
const GROUPS_TTL = 30;

export async function readGroupsCache<T>(userId: string): Promise<T | null> {
  if (!redis) return null;
  try {
    return await redis.get<T>(`${GROUPS_PREFIX}${userId}`) ?? null;
  } catch {
    return null;
  }
}

export async function writeGroupsCache<T>(userId: string, data: T): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(`${GROUPS_PREFIX}${userId}`, data, { ex: GROUPS_TTL });
  } catch { /* swallow */ }
}

export async function invalidateGroupsCache(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`${GROUPS_PREFIX}${userId}`);
  } catch { /* swallow */ }
}
