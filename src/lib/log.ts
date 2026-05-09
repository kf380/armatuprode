type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, event: string, ctx: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ level, event, ts: new Date().toISOString(), ...ctx });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export async function logSettled<T>(
  event: string,
  ctx: Record<string, unknown>,
  promises: Array<Promise<T>>,
): Promise<PromiseSettledResult<T>[]> {
  const results = await Promise.allSettled(promises);
  const failures = results
    .map((r, i) => ({ r, i }))
    .filter((x) => x.r.status === "rejected");
  if (failures.length > 0) {
    log("error", event, {
      ...ctx,
      total: results.length,
      failed: failures.length,
      errors: failures.map((f) => String((f.r as PromiseRejectedResult).reason)),
    });
  }
  return results;
}
