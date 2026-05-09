/**
 * Phase 2 — priceForPool() math invariants.
 *
 * Defaults: base USD 5, 7% of declared pool, cap USD 400.
 * Conversion: USD_TO_ARS_RATE = 1200 (default when env not set).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { priceForPool } from "@/lib/plans";

const env = process.env as Record<string, string | undefined>;

describe("priceForPool — boundaries with default config (base 5, 7%, cap 400, ARS 1200)", () => {
  beforeEach(() => {
    delete env.MANUAL_POOL_FEE_BASE_USD;
    delete env.MANUAL_POOL_FEE_PCT;
    delete env.MANUAL_POOL_FEE_CAP_USD;
    env.USD_TO_ARS_RATE = "1200";
  });
  afterEach(() => {
    delete env.USD_TO_ARS_RATE;
  });

  it("declared pool 0 → floor at base USD 5", () => {
    const q = priceForPool(0);
    expect(q.amountUsd).toBe(5);
    expect(q.feeCappedAt).toBe(false);
  });

  it("negative declared → treated as 0 → floor", () => {
    expect(priceForPool(-100).amountUsd).toBe(5);
  });

  it("NaN declared → treated as 0 → floor", () => {
    expect(priceForPool(NaN).amountUsd).toBe(5);
  });

  it("very small pool (no impact above floor)", () => {
    // $5.000 ARS = USD 4.16 → 7% = 0.29 USD → total 5.29 → rounded 5.29
    const q = priceForPool(5_000);
    expect(q.amountUsd).toBe(5.29);
  });

  it("$20.000 ARS pool → ~USD 6.17", () => {
    // pool USD = 20000/1200 = 16.66, 7% = 1.16, total 6.16
    const q = priceForPool(20_000);
    expect(q.amountUsd).toBeCloseTo(6.17, 1);
  });

  it("$40.000 ARS pool → ~USD 7.33", () => {
    const q = priceForPool(40_000);
    expect(q.amountUsd).toBeCloseTo(7.33, 1);
  });

  it("$240.000 ARS pool → ~USD 19", () => {
    const q = priceForPool(240_000);
    expect(q.amountUsd).toBeCloseTo(19, 0);
  });

  it("$2.000.000 ARS pool → ~USD 121.66", () => {
    const q = priceForPool(2_000_000);
    expect(q.amountUsd).toBeCloseTo(121.66, 1);
  });

  it("cap activates at very large pool ($7M ARS+)", () => {
    const q = priceForPool(7_500_000);
    expect(q.amountUsd).toBe(400);
    expect(q.feeCappedAt).toBe(true);
  });

  it("massive pool stays at cap", () => {
    const q = priceForPool(50_000_000);
    expect(q.amountUsd).toBe(400);
    expect(q.feeCappedAt).toBe(true);
  });

  it("cap activation point is approx pool USD 5642 (= ($400-$5)/0.07)", () => {
    // (400-5)/0.07 = 5642.85 USD → 6_771_428 ARS at 1200
    const justBelow = priceForPool(6_700_000);
    const justAbove = priceForPool(6_900_000);
    expect(justBelow.feeCappedAt).toBe(false);
    expect(justAbove.feeCappedAt).toBe(true);
  });
});

describe("priceForPool — env override", () => {
  beforeEach(() => {
    env.USD_TO_ARS_RATE = "1200";
  });
  afterEach(() => {
    delete env.MANUAL_POOL_FEE_BASE_USD;
    delete env.MANUAL_POOL_FEE_PCT;
    delete env.MANUAL_POOL_FEE_CAP_USD;
    delete env.USD_TO_ARS_RATE;
  });

  it("can change base via env", () => {
    env.MANUAL_POOL_FEE_BASE_USD = "10";
    const q = priceForPool(0);
    expect(q.amountUsd).toBe(10);
  });

  it("can change pct via env (5%)", () => {
    env.MANUAL_POOL_FEE_PCT = "0.05";
    const q = priceForPool(120_000); // USD 100, 5% = USD 5, total = USD 10
    expect(q.amountUsd).toBeCloseTo(10, 0);
  });

  it("can lower cap via env", () => {
    env.MANUAL_POOL_FEE_CAP_USD = "50";
    const q = priceForPool(10_000_000);
    expect(q.amountUsd).toBe(50);
    expect(q.feeCappedAt).toBe(true);
  });

  it("invalid env values fall back to defaults", () => {
    env.MANUAL_POOL_FEE_PCT = "abc";
    const q = priceForPool(120_000);
    // default 7% → 100 * 0.07 = 7 + 5 base = 12
    expect(q.amountUsd).toBeCloseTo(12, 0);
  });

  it("rejects pct outside 0-1", () => {
    env.MANUAL_POOL_FEE_PCT = "1.5";
    const q = priceForPool(120_000);
    // falls back to default 7% → 12
    expect(q.amountUsd).toBeCloseTo(12, 0);
  });
});

describe("priceForPool — quote shape sanity", () => {
  beforeEach(() => {
    env.USD_TO_ARS_RATE = "1200";
  });
  afterEach(() => {
    delete env.USD_TO_ARS_RATE;
  });

  it("returns full breakdown structure", () => {
    const q = priceForPool(120_000);
    expect(q).toHaveProperty("declaredPoolArs");
    expect(q).toHaveProperty("declaredPoolUsd");
    expect(q).toHaveProperty("feeBaseUsd");
    expect(q).toHaveProperty("feePctApplied");
    expect(q).toHaveProperty("feeVariableUsd");
    expect(q).toHaveProperty("feeCapUsd");
    expect(q).toHaveProperty("feeCappedAt");
    expect(q).toHaveProperty("amountUsd");
    expect(q).toHaveProperty("amountArs");
    expect(q).toHaveProperty("arsRate");
  });

  it("amountArs is amountUsd × arsRate (rounded)", () => {
    const q = priceForPool(120_000);
    expect(q.amountArs).toBe(Math.round(q.amountUsd * q.arsRate));
  });
});
