/**
 * Format a UTC match date for display.
 *
 * Matches are stored in UTC. By default we show kickoffs in the **user's
 * local timezone** (resolved from the browser), so a user in Mexico sees
 * Mexico time, a user in Buenos Aires sees ART, etc. AR is only the
 * server-side fallback when there's no browser context.
 *
 * Use this helper anywhere we render a kickoff time. NEVER format dates
 * inline with `toLocaleString()` without this helper.
 */

const AR_TZ_FALLBACK = "America/Argentina/Buenos_Aires";

export function browserTimezone(): string {
  if (typeof Intl === "undefined") return AR_TZ_FALLBACK;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || AR_TZ_FALLBACK;
  } catch {
    return AR_TZ_FALLBACK;
  }
}

export interface FormatOptions {
  /** IANA tz. If omitted, uses the browser's resolved timezone. */
  timezone?: string;
  withWeekday?: boolean;
  withYear?: boolean;
}

export function formatMatchDate(
  matchDate: Date | string,
  opts: FormatOptions = {},
): string {
  const d = matchDate instanceof Date ? matchDate : new Date(matchDate);
  const tz = opts.timezone ?? browserTimezone();
  return d.toLocaleString(undefined, {
    timeZone: tz,
    weekday: opts.withWeekday ? "short" : undefined,
    day: "2-digit",
    month: "short",
    year: opts.withYear ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatMatchTime(
  matchDate: Date | string,
  timezone?: string,
): string {
  const d = matchDate instanceof Date ? matchDate : new Date(matchDate);
  const tz = timezone ?? browserTimezone();
  return d.toLocaleTimeString(undefined, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
