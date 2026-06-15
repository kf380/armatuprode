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

/**
 * Forced invalidation cuando un side-effect del user cambia algo del payload
 * (carga predicción, se une a grupo, gana badge). Mejor poner cache a 0
 * para que el próximo GET pegue a DB y traiga lo fresco.
 */
export async function invalidateDashboardCache(userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`${KEY_PREFIX}${userId}`);
  } catch {
    /* swallow */
  }
}
