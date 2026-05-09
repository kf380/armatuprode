import { describe, it, expect } from "vitest";
import { formatMatchDate, formatMatchTime, browserTimezone } from "@/lib/format-date";

describe("formatMatchTime", () => {
  it("converts UTC to Argentina time when AR tz passed explicitly", () => {
    // 2026-06-11T19:00:00Z → 16:00 ART (UTC-3)
    const out = formatMatchTime("2026-06-11T19:00:00.000Z", "America/Argentina/Buenos_Aires");
    expect(out).toMatch(/^16:00/);
  });

  it("converts UTC to NY time when explicit", () => {
    // 2026-06-11T19:00:00Z → 15:00 EDT (UTC-4 in June)
    const out = formatMatchTime("2026-06-11T19:00:00.000Z", "America/New_York");
    expect(out).toMatch(/^15:00/);
  });

  it("converts UTC to Mexico City time when explicit", () => {
    // 2026-06-11T19:00:00Z → 13:00 CST (UTC-6, Mexico no longer observes DST)
    const out = formatMatchTime("2026-06-11T19:00:00.000Z", "America/Mexico_City");
    expect(out).toMatch(/^13:00/);
  });

  it("uses browser timezone by default when no tz passed", () => {
    // We can't pin the test runner's tz, but the call must not throw and
    // must produce HH:MM format.
    const out = formatMatchTime("2026-06-11T19:00:00.000Z");
    expect(out).toMatch(/^\d{2}:\d{2}/);
  });
});

describe("formatMatchDate", () => {
  it("includes day and month", () => {
    const out = formatMatchDate("2026-07-19T22:00:00.000Z", {
      timezone: "America/Argentina/Buenos_Aires",
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/\d{2}/);
  });
});

describe("browserTimezone", () => {
  it("returns a valid IANA timezone string or AR fallback", () => {
    const tz = browserTimezone();
    // Should not throw and should be a non-empty string
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});
