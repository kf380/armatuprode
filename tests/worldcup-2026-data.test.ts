import { describe, it, expect } from "vitest";
import { TOURNAMENT, TEAMS, MATCHES } from "@/data/worldcup-2026";

describe("FIFA World Cup 2026 — data shape", () => {
  it("tournament metadata is correct", () => {
    expect(TOURNAMENT.slug).toBe("world-cup-2026");
    expect(TOURNAMENT.year).toBe(2026);
    expect(TOURNAMENT.hostCountries).toEqual(["Canada", "Mexico", "United States"]);
  });

  it("has exactly 48 teams", () => {
    expect(TEAMS).toHaveLength(48);
  });

  it("has 12 groups (A-L) with 4 slots each", () => {
    const groups = new Set(TEAMS.map((t) => t.groupCode));
    expect(groups.size).toBe(12);
    for (const g of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
      const teams = TEAMS.filter((t) => t.groupCode === g);
      expect(teams).toHaveLength(4);
      const slots = teams.map((t) => t.groupSlot).sort();
      expect(slots).toEqual([1, 2, 3, 4]);
    }
  });

  it("hosts are placed at A1/B1/D1 and not placeholders", () => {
    const a1 = TEAMS.find((t) => t.groupCode === "A" && t.groupSlot === 1);
    const b1 = TEAMS.find((t) => t.groupCode === "B" && t.groupSlot === 1);
    const d1 = TEAMS.find((t) => t.groupCode === "D" && t.groupSlot === 1);
    expect(a1?.code).toBe("MEX");
    expect(b1?.code).toBe("CAN");
    expect(d1?.code).toBe("USA");
    for (const h of [a1, b1, d1]) expect(h?.isPlaceholder).toBe(false);
  });

  it("team codes are unique across the tournament", () => {
    const codes = TEAMS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("FIFA World Cup 2026 — matches", () => {
  it("has exactly 104 matches", () => {
    expect(MATCHES).toHaveLength(104);
  });

  it("officialMatchNumber is unique and sequential 1..104", () => {
    const nums = MATCHES.map((m) => m.officialMatchNumber).sort((a, b) => a - b);
    expect(nums[0]).toBe(1);
    expect(nums[nums.length - 1]).toBe(104);
    expect(new Set(nums).size).toBe(104);
  });

  it("stage distribution matches the tournament structure", () => {
    const counts = MATCHES.reduce<Record<string, number>>((acc, m) => {
      acc[m.stage] = (acc[m.stage] || 0) + 1;
      return acc;
    }, {});
    expect(counts.GROUP_STAGE).toBe(72);
    expect(counts.ROUND_OF_32).toBe(16);
    expect(counts.ROUND_OF_16).toBe(8);
    expect(counts.QUARTER_FINALS).toBe(4);
    expect(counts.SEMI_FINALS).toBe(2);
    expect(counts.THIRD_PLACE).toBe(1);
    expect(counts.FINAL).toBe(1);
  });

  it("group stage has 6 matches per group", () => {
    for (const g of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
      const groupMatches = MATCHES.filter((m) => m.stage === "GROUP_STAGE" && m.group === g);
      expect(groupMatches).toHaveLength(6);
    }
  });

  it("all matches have a valid UTC matchDate", () => {
    for (const m of MATCHES) {
      const d = new Date(m.matchDateUtc);
      expect(Number.isNaN(d.getTime())).toBe(false);
      expect(m.matchDateUtc.endsWith("Z")).toBe(true);
    }
  });

  it("opening match #1 is in Mexico City on 2026-06-11", () => {
    const opener = MATCHES.find((m) => m.officialMatchNumber === 1);
    expect(opener?.city).toBe("Mexico City");
    expect(opener?.country).toBe("Mexico");
    expect(opener?.matchDateUtc.startsWith("2026-06-11")).toBe(true);
  });

  it("final #104 is at MetLife Stadium on 2026-07-19", () => {
    const final = MATCHES.find((m) => m.officialMatchNumber === 104);
    expect(final?.venue).toBe("MetLife Stadium");
    expect(final?.matchDateUtc.startsWith("2026-07-19")).toBe(true);
    expect(final?.stage).toBe("FINAL");
  });

  it("all matches carry an official FIFA source label", () => {
    for (const m of MATCHES) {
      expect(m.source).toMatch(/^FIFA official schedule/);
    }
  });

  it("knockout matches use placeholders, never real team codes", () => {
    const knockouts = MATCHES.filter((m) => m.stage !== "GROUP_STAGE");
    for (const m of knockouts) {
      // Knockout placeholder formats:
      //   "1A".."2L"          group winners/runner-ups
      //   "3-ABCDF" etc.      best third from a set of groups
      //   "W73".."W102"       winner of match N
      //   "L101", "L102"      loser of match N (bronze final)
      const looksLikePlaceholder = (code: string) =>
        /^[12][A-L]$/.test(code) ||
        /^3-[A-L]{2,6}$/.test(code) ||
        /^W\d+$/.test(code) ||
        /^L\d+$/.test(code);
      expect(looksLikePlaceholder(m.teamACode)).toBe(true);
      expect(looksLikePlaceholder(m.teamBCode)).toBe(true);
    }
  });
});
