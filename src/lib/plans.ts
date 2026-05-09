/**
 * Plan definitions — single source of truth for limits and pricing.
 *
 * Pricing is anchored in USD per the business model. We display ARS via
 * a conversion factor (env: USD_TO_ARS_RATE) until we add a live FX feed.
 *
 * The B2B billing model is "organizer pays" — there is NO per-player entry fee
 * in this evolution. Cash pools (POOL_ENTRY) remain a separate legacy flow
 * gated by ENABLE_REAL_MONEY_POOLS.
 */

import type { PlanType, GroupType } from "@prisma/client";

export interface PlanConfig {
  groupType: GroupType;
  /** Maximum participants allowed in a group with this plan. */
  maxPlayers: number;
  /** Flat USD price for activation (one-shot). 0 = free. */
  flatUsd: number;
  /** Per-active-player USD pricing (org plans). 0 = no per-player. */
  pricePerPlayerUsd: number;
  /** Minimum USD floor when using per-player pricing. */
  minimumUsd: number;
  customLogo: boolean;
  customPrize: boolean;
  analytics: "none" | "basic" | "advanced";
  exportParticipants: boolean;
  /** If true, users CANNOT select this plan from public UI; admin-only. */
  internalOnly: boolean;
}

export const PLANS: Record<PlanType, PlanConfig> = {
  FREE: {
    groupType: "PERSONAL",
    maxPlayers: 10,
    flatUsd: 0,
    pricePerPlayerUsd: 0,
    minimumUsd: 0,
    customLogo: false,
    customPrize: false,
    analytics: "none",
    exportParticipants: false,
    internalOnly: false,
  },
  PERSONAL_PLUS: {
    groupType: "PERSONAL",
    maxPlayers: 50,
    flatUsd: 12,
    pricePerPlayerUsd: 0,
    minimumUsd: 0,
    customLogo: false,
    customPrize: true,
    analytics: "basic",
    exportParticipants: false,
    internalOnly: false,
  },
  COMMUNITY: {
    groupType: "ORGANIZATION",
    maxPlayers: 100,
    flatUsd: 0,
    pricePerPlayerUsd: 3,
    minimumUsd: 60,
    customLogo: true,
    customPrize: true,
    analytics: "basic",
    exportParticipants: false,
    internalOnly: false,
  },
  BUSINESS: {
    groupType: "ORGANIZATION",
    maxPlayers: 1000,
    flatUsd: 0,
    pricePerPlayerUsd: 5,
    minimumUsd: 300,
    customLogo: true,
    customPrize: true,
    analytics: "advanced",
    exportParticipants: true,
    internalOnly: false,
  },
  WHITE_LABEL: {
    groupType: "ORGANIZATION",
    maxPlayers: 99999,
    flatUsd: 0,
    pricePerPlayerUsd: 0, // custom pricing, set manually
    minimumUsd: 0,
    customLogo: true,
    customPrize: true,
    analytics: "advanced",
    exportParticipants: true,
    internalOnly: true, // never selectable from public UI
  },
};

/** Plans that the public UI is allowed to offer. Excludes WHITE_LABEL. */
export const PUBLIC_PLANS: PlanType[] = (Object.keys(PLANS) as PlanType[]).filter(
  (p) => !PLANS[p].internalOnly,
);

/**
 * Compute the activation price for a given plan and estimated participants,
 * in USD and ARS. Returns 0/0 for FREE.
 */
export interface PriceQuote {
  planType: PlanType;
  estimatedPlayers: number;
  amountUsd: number;
  amountArs: number;
  arsRate: number;
  priceMethod: "free" | "flat" | "per_player_with_min";
}

const USD_TO_ARS_DEFAULT = 1200;

function getArsRate(): number {
  const v = process.env.USD_TO_ARS_RATE;
  if (!v) return USD_TO_ARS_DEFAULT;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : USD_TO_ARS_DEFAULT;
}

/**
 * Defense-in-depth: WHITE_LABEL is internal-only AND has no public pricing
 * formula. Any code path that asks priceFor(WHITE_LABEL) is a bug — throw
 * loudly instead of silently returning 0. Custom-priced WHITE_LABEL deals
 * go through manual admin operations, not this helper.
 */
export class WhiteLabelPricingError extends Error {
  constructor() {
    super("WHITE_LABEL has no public pricing. Set custom amount via admin.");
    this.name = "WhiteLabelPricingError";
  }
}

export function priceFor(planType: PlanType, estimatedPlayers: number): PriceQuote {
  if (planType === "WHITE_LABEL") {
    throw new WhiteLabelPricingError();
  }
  const plan = PLANS[planType];
  const arsRate = getArsRate();
  if (plan.flatUsd === 0 && plan.pricePerPlayerUsd === 0) {
    return { planType, estimatedPlayers, amountUsd: 0, amountArs: 0, arsRate, priceMethod: "free" };
  }
  if (plan.pricePerPlayerUsd > 0) {
    const computed = plan.pricePerPlayerUsd * Math.max(0, estimatedPlayers);
    const amountUsd = Math.max(plan.minimumUsd, computed);
    return {
      planType,
      estimatedPlayers,
      amountUsd,
      amountArs: Math.round(amountUsd * arsRate),
      arsRate,
      priceMethod: "per_player_with_min",
    };
  }
  return {
    planType,
    estimatedPlayers,
    amountUsd: plan.flatUsd,
    amountArs: Math.round(plan.flatUsd * arsRate),
    arsRate,
    priceMethod: "flat",
  };
}

/**
 * Authoritative limits for a given plan. Server-side gating reads from here,
 * never trusts a frontend-supplied participantLimit.
 */
export function resolveLimits(planType: PlanType): { maxPlayers: number } {
  return { maxPlayers: PLANS[planType].maxPlayers };
}

/**
 * Returns true if a plan is offerable to the user via public UI/API. Used to
 * reject WHITE_LABEL coming from a request body.
 */
export function isPublicPlan(planType: PlanType): boolean {
  return !PLANS[planType].internalOnly;
}

// ---------------------------------------------------------------------------
// Phase 2 — Manual Pool pricing (Versión B)
// ---------------------------------------------------------------------------

/**
 * Compute the SaaS fee charged to the organizer when their group is in
 * MoneyMode=MANUAL_POOL. The fee is based on the *declared* pool, NOT on
 * money ArmaTuProde holds — the platform never custodies pool funds.
 *
 *   fee_usd = clamp(base + pct * pool_usd, base, cap)
 *
 * Defaults (overridable via env):
 *   MANUAL_POOL_FEE_BASE_USD = 5
 *   MANUAL_POOL_FEE_PCT      = 0.07  (7%)
 *   MANUAL_POOL_FEE_CAP_USD  = 400
 *
 * The `declaredPoolArs` argument is the total pool the organizer claims will
 * be collected (entry × estimated players). 0 or negative = empty pool, fee
 * floors at base.
 */
export interface ManualPoolFeeQuote {
  declaredPoolArs: number;
  declaredPoolUsd: number;
  feeBaseUsd: number;
  feePctApplied: number;
  feeVariableUsd: number;
  feeCapUsd: number;
  feeCappedAt: boolean;
  amountUsd: number;
  amountArs: number;
  arsRate: number;
}

const FEE_BASE_DEFAULT = 5;
const FEE_PCT_DEFAULT = 0.07;
const FEE_CAP_DEFAULT = 400;

function getFeeBaseUsd(): number {
  const v = process.env.MANUAL_POOL_FEE_BASE_USD;
  if (!v) return FEE_BASE_DEFAULT;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : FEE_BASE_DEFAULT;
}

function getFeePct(): number {
  const v = process.env.MANUAL_POOL_FEE_PCT;
  if (!v) return FEE_PCT_DEFAULT;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : FEE_PCT_DEFAULT;
}

function getFeeCapUsd(): number {
  const v = process.env.MANUAL_POOL_FEE_CAP_USD;
  if (!v) return FEE_CAP_DEFAULT;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : FEE_CAP_DEFAULT;
}

export function priceForPool(declaredPoolArs: number): ManualPoolFeeQuote {
  const arsRate = getArsRate();
  const feeBaseUsd = getFeeBaseUsd();
  const feePct = getFeePct();
  const feeCapUsd = getFeeCapUsd();

  const safePool = Number.isFinite(declaredPoolArs) && declaredPoolArs > 0 ? declaredPoolArs : 0;
  const declaredPoolUsd = safePool / arsRate;
  const feeVariableUsd = declaredPoolUsd * feePct;

  const rawFeeUsd = feeBaseUsd + feeVariableUsd;
  const cappedAt = rawFeeUsd > feeCapUsd;
  const amountUsd = Math.min(Math.max(rawFeeUsd, feeBaseUsd), feeCapUsd);

  // Round to 2 decimals for USD display, ARS to integer (whole pesos).
  const amountUsdRounded = Math.round(amountUsd * 100) / 100;
  const amountArs = Math.round(amountUsdRounded * arsRate);

  return {
    declaredPoolArs: safePool,
    declaredPoolUsd: Math.round(declaredPoolUsd * 100) / 100,
    feeBaseUsd,
    feePctApplied: feePct,
    feeVariableUsd: Math.round(feeVariableUsd * 100) / 100,
    feeCapUsd,
    feeCappedAt: cappedAt,
    amountUsd: amountUsdRounded,
    amountArs,
    arsRate,
  };
}
