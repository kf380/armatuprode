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

/**
 * Returns the YYYY-MM-DD date string of a moment, IN THE GIVEN TIMEZONE.
 * Use this to compare two moments by "calendar day" without UTC drift.
 *
 * Why: `new Date(iso).toISOString().split("T")[0]` gives the UTC day, which
 * disagrees with the user's local calendar near midnight. This helper uses
 * Intl.DateTimeFormat with the target timezone to render the same moment
 * as a local date string.
 */
export function calendarDayInTz(
  moment: Date | string,
  timezone?: string,
): string {
  const d = moment instanceof Date ? moment : new Date(moment);
  const tz = timezone ?? browserTimezone();
  // en-CA gives YYYY-MM-DD format directly.
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

export type MatchDayBucket = "past" | "today" | "tomorrow" | "thisWeek" | "later";

/**
 * Classify a kickoff into one of: today / tomorrow / thisWeek / later / past.
 * "thisWeek" = within the next 7 days but not today/tomorrow.
 * Comparison is done in the given timezone (or browser default).
 */
export function classifyMatchDay(
  matchDate: Date | string,
  timezone?: string,
  now: Date = new Date(),
): MatchDayBucket {
  const tz = timezone ?? browserTimezone();
  const matchDay = calendarDayInTz(matchDate, tz);
  const today = calendarDayInTz(now, tz);
  if (matchDay < today) return "past";
  if (matchDay === today) return "today";
  // Compute tomorrow by adding 24h then re-rendering in tz.
  const tomorrow = calendarDayInTz(new Date(now.getTime() + 24 * 60 * 60 * 1000), tz);
  if (matchDay === tomorrow) return "tomorrow";
  // Within next 7 days?
  const weekAhead = calendarDayInTz(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), tz);
  if (matchDay <= weekAhead) return "thisWeek";
  return "later";
}

/**
 * Human-readable day label for a kickoff. Returns "Hoy" / "Mañana" /
 * "Vie 12 jun" / etc. in the given timezone.
 */
export function formatMatchDayLabel(
  matchDate: Date | string,
  timezone?: string,
  now: Date = new Date(),
): string {
  const bucket = classifyMatchDay(matchDate, timezone, now);
  if (bucket === "today") return "Hoy";
  if (bucket === "tomorrow") return "Mañana";
  const tz = timezone ?? browserTimezone();
  const d = matchDate instanceof Date ? matchDate : new Date(matchDate);
  return d.toLocaleDateString("es-AR", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
