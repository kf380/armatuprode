/**
 * classifyMatchDay + formatMatchDayLabel + calendarDayInTz
 *
 * Critical: timezone-aware. Comparing match days must NOT use UTC dates,
 * otherwise users near midnight see "tomorrow" labels for matches that are
 * in fact today in their local time.
 */
import { describe, it, expect } from "vitest";
import {
  classifyMatchDay,
  calendarDayInTz,
  formatMatchDayLabel,
} from "@/lib/format-date";

const AR_TZ = "America/Argentina/Buenos_Aires";

describe("calendarDayInTz", () => {
  it("returns YYYY-MM-DD format", () => {
    const out = calendarDayInTz("2026-06-15T14:00:00Z", AR_TZ);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("late-night UTC moment is still 'today' in AR if user's local clock says so", () => {
    // 02:00 UTC on 16-jun = 23:00 ART on 15-jun
    const utcMoment = "2026-06-16T02:00:00Z";
    expect(calendarDayInTz(utcMoment, AR_TZ)).toBe("2026-06-15");
  });

  it("respects different timezones", () => {
    const m = "2026-06-15T18:00:00Z"; // 18:00 UTC = 15:00 ART = 11:00 NY
    expect(calendarDayInTz(m, "America/Argentina/Buenos_Aires")).toBe("2026-06-15");
    expect(calendarDayInTz(m, "America/New_York")).toBe("2026-06-15");
  });
});

describe("classifyMatchDay buckets", () => {
  // Use a frozen "now" to keep tests deterministic.
  // 12:00 ART on 15-jun-2026 = 15:00 UTC.
  const NOW = new Date("2026-06-15T15:00:00Z");

  it("today bucket — same calendar day in tz", () => {
    const kickoff = "2026-06-15T20:00:00Z"; // 17:00 ART
    expect(classifyMatchDay(kickoff, AR_TZ, NOW)).toBe("today");
  });

  it("tomorrow bucket — next calendar day in tz", () => {
    const kickoff = "2026-06-16T18:00:00Z"; // 15:00 ART next day
    expect(classifyMatchDay(kickoff, AR_TZ, NOW)).toBe("tomorrow");
  });

  it("this week bucket — within 7 days but not today/tomorrow", () => {
    const kickoff = "2026-06-19T18:00:00Z"; // +4 days
    expect(classifyMatchDay(kickoff, AR_TZ, NOW)).toBe("thisWeek");
  });

  it("later bucket — more than 7 days out", () => {
    const kickoff = "2026-06-30T18:00:00Z"; // +15 days
    expect(classifyMatchDay(kickoff, AR_TZ, NOW)).toBe("later");
  });

  it("past bucket — before today's date", () => {
    const kickoff = "2026-06-10T18:00:00Z"; // 5 days ago
    expect(classifyMatchDay(kickoff, AR_TZ, NOW)).toBe("past");
  });

  it("midnight UTC corner case stays in correct local bucket", () => {
    // 02:00 UTC 16-jun = 23:00 ART 15-jun → still "today" for AR user
    const kickoff = "2026-06-16T02:00:00Z";
    expect(classifyMatchDay(kickoff, AR_TZ, NOW)).toBe("today");
  });
});

describe("formatMatchDayLabel", () => {
  const NOW = new Date("2026-06-15T15:00:00Z"); // 12:00 ART

  it("returns 'Hoy' for today", () => {
    expect(formatMatchDayLabel("2026-06-15T20:00:00Z", AR_TZ, NOW)).toBe("Hoy");
  });

  it("returns 'Mañana' for tomorrow", () => {
    expect(formatMatchDayLabel("2026-06-16T20:00:00Z", AR_TZ, NOW)).toBe("Mañana");
  });

  it("returns short Spanish weekday + day for further dates", () => {
    const label = formatMatchDayLabel("2026-06-19T20:00:00Z", AR_TZ, NOW);
    // Format like "vie 19 jun" or "vie. 19 jun"
    expect(label.toLowerCase()).toMatch(/vie/);
    expect(label).toMatch(/19/);
  });
});
