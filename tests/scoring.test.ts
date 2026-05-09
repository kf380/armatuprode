import { describe, it, expect } from "vitest";
import { calculatePoints, calculatePointsDetailed, calculateXpForPrediction } from "@/lib/scoring";

describe("calculatePoints — group stage", () => {
  it("exact score = 3 points", () => {
    expect(calculatePoints(2, 1, 2, 1, "GROUP_STAGE")).toBe(3);
  });
  it("correct winner only = 1 point", () => {
    expect(calculatePoints(3, 1, 2, 0, "GROUP_STAGE")).toBe(1);
  });
  it("draw with wrong score = 1 point", () => {
    expect(calculatePoints(0, 0, 1, 1, "GROUP_STAGE")).toBe(1);
  });
  it("wrong winner = 0", () => {
    expect(calculatePoints(2, 0, 0, 2, "GROUP_STAGE")).toBe(0);
  });
});

describe("calculatePoints — knockout", () => {
  it("exact + correct qualifier = 5 + 3 = 8", () => {
    expect(calculatePoints(2, 1, 2, 1, "QUARTER_FINALS", "ARG", "ARG")).toBe(8);
  });
  it("winner + correct qualifier = 2 + 3 = 5", () => {
    expect(calculatePoints(3, 1, 2, 0, "ROUND_OF_16", "ARG", "ARG")).toBe(5);
  });
  it("wrong winner + correct qualifier = 0 + 3 = 3", () => {
    expect(calculatePoints(0, 2, 2, 0, "FINAL", "ARG", "ARG")).toBe(3);
  });
  it("wrong qualifier ignored", () => {
    expect(calculatePoints(2, 1, 2, 1, "FINAL", "BRA", "ARG")).toBe(5);
  });
});

describe("calculatePointsDetailed", () => {
  it("returns breakdown with isExact + isWinner + qualifierCorrect flags", () => {
    const r = calculatePointsDetailed(1, 0, 1, 0, "ROUND_OF_16", "ARG", "ARG");
    expect(r).toEqual({ total: 8, isExact: true, isWinner: true, qualifierCorrect: true });
  });
  it("draw is winner", () => {
    const r = calculatePointsDetailed(0, 0, 1, 1, "GROUP_STAGE");
    expect(r.isWinner).toBe(true);
    expect(r.isExact).toBe(false);
    expect(r.total).toBe(1);
  });
});

describe("calculateXpForPrediction", () => {
  it("exact score gives +50 XP", () => {
    const xp = calculateXpForPrediction(3, "GROUP_STAGE", true, true);
    expect(xp).toEqual([{ amount: 50, reason: "exact_score" }]);
  });
  it("only winner gives +20 XP", () => {
    const xp = calculateXpForPrediction(1, "GROUP_STAGE", false, true);
    expect(xp).toEqual([{ amount: 20, reason: "correct_winner" }]);
  });
  it("wrong gives no XP", () => {
    const xp = calculateXpForPrediction(0, "GROUP_STAGE", false, false);
    expect(xp).toEqual([]);
  });
});
