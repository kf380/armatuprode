import { describe, it, expect } from "vitest";
import { classifyPendingOrder } from "@/lib/group-policy";

describe("classifyPendingOrder — three time buckets", () => {
  it("WARN for very young orders (just opened in another tab)", () => {
    const r = classifyPendingOrder(0);
    expect(r.action).toBe("WARN");
    if (r.action === "WARN") expect(r.minutesLeft).toBeGreaterThanOrEqual(1);
  });

  it("WARN until 89 seconds", () => {
    const r = classifyPendingOrder(89);
    expect(r.action).toBe("WARN");
    if (r.action === "WARN") expect(r.minutesLeft).toBe(1);
  });

  it("REUSE at exactly 90 seconds", () => {
    expect(classifyPendingOrder(90).action).toBe("REUSE");
  });

  it("REUSE at 1 hour", () => {
    expect(classifyPendingOrder(3600).action).toBe("REUSE");
  });

  it("REUSE at 5h59m", () => {
    expect(classifyPendingOrder(6 * 60 * 60 - 1).action).toBe("REUSE");
  });

  it("REPLACE at exactly 6h", () => {
    expect(classifyPendingOrder(6 * 60 * 60).action).toBe("REPLACE");
  });

  it("REPLACE at 24h+", () => {
    expect(classifyPendingOrder(24 * 60 * 60 + 100).action).toBe("REPLACE");
  });

  it("REUSE for negative ageSeconds (clock skew defense)", () => {
    expect(classifyPendingOrder(-1).action).toBe("REUSE");
    expect(classifyPendingOrder(-3600).action).toBe("REUSE");
  });

  it("WARN minutesLeft is at least 1, never 0", () => {
    for (let s = 0; s < 90; s++) {
      const r = classifyPendingOrder(s);
      expect(r.action).toBe("WARN");
      if (r.action === "WARN") expect(r.minutesLeft).toBeGreaterThanOrEqual(1);
    }
  });
});
