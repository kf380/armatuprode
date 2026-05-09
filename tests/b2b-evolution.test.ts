import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PLANS, PUBLIC_PLANS, isPublicPlan, priceFor, resolveLimits, WhiteLabelPricingError } from "@/lib/plans";
import { canJoinGroup, canEditGroup, canViewBilling, isAtCapacity } from "@/lib/group-policy";
import { flags, canPlayersBeCharged } from "@/lib/flags";

const env = process.env as Record<string, string | undefined>;
const original = { ...env };

function resetEnv() {
  for (const k of Object.keys(env)) delete env[k];
  Object.assign(env, original);
}

// ----------------------------------------------------------------------------
// plans.ts
// ----------------------------------------------------------------------------

describe("plans — config invariants", () => {
  it("FREE has 0 cost", () => {
    expect(PLANS.FREE.flatUsd).toBe(0);
    expect(PLANS.FREE.pricePerPlayerUsd).toBe(0);
    expect(PLANS.FREE.maxPlayers).toBeGreaterThan(0);
  });

  it("PERSONAL_PLUS allows more players than FREE", () => {
    expect(PLANS.PERSONAL_PLUS.maxPlayers).toBeGreaterThan(PLANS.FREE.maxPlayers);
  });

  it("COMMUNITY and BUSINESS are ORGANIZATION type", () => {
    expect(PLANS.COMMUNITY.groupType).toBe("ORGANIZATION");
    expect(PLANS.BUSINESS.groupType).toBe("ORGANIZATION");
  });

  it("BUSINESS minimumUsd >= COMMUNITY minimumUsd", () => {
    expect(PLANS.BUSINESS.minimumUsd).toBeGreaterThanOrEqual(PLANS.COMMUNITY.minimumUsd);
  });

  it("WHITE_LABEL is internal-only and not in public plans", () => {
    expect(PLANS.WHITE_LABEL.internalOnly).toBe(true);
    expect(PUBLIC_PLANS).not.toContain("WHITE_LABEL");
    expect(isPublicPlan("WHITE_LABEL")).toBe(false);
  });

  it("public plans contain FREE/PERSONAL_PLUS/COMMUNITY/BUSINESS", () => {
    expect(PUBLIC_PLANS).toEqual(expect.arrayContaining(["FREE", "PERSONAL_PLUS", "COMMUNITY", "BUSINESS"]));
  });
});

describe("plans — pricing", () => {
  beforeEach(() => {
    resetEnv();
    env.USD_TO_ARS_RATE = "1000";
  });
  afterEach(() => resetEnv());

  it("FREE returns 0/0", () => {
    const q = priceFor("FREE", 50);
    expect(q.amountUsd).toBe(0);
    expect(q.amountArs).toBe(0);
    expect(q.priceMethod).toBe("free");
  });

  it("PERSONAL_PLUS uses flat fee", () => {
    const q = priceFor("PERSONAL_PLUS", 100);
    expect(q.amountUsd).toBe(PLANS.PERSONAL_PLUS.flatUsd);
    expect(q.amountArs).toBe(PLANS.PERSONAL_PLUS.flatUsd * 1000);
    expect(q.priceMethod).toBe("flat");
  });

  it("COMMUNITY: per-player above floor", () => {
    // Use enough players that the per-player computation exceeds the floor
    const playersAboveFloor = Math.ceil(PLANS.COMMUNITY.minimumUsd / PLANS.COMMUNITY.pricePerPlayerUsd) + 10;
    const q = priceFor("COMMUNITY", playersAboveFloor);
    expect(q.amountUsd).toBe(playersAboveFloor * PLANS.COMMUNITY.pricePerPlayerUsd);
    expect(q.priceMethod).toBe("per_player_with_min");
  });

  it("COMMUNITY: small group hits the minimum floor", () => {
    const q = priceFor("COMMUNITY", 5);
    expect(q.amountUsd).toBe(PLANS.COMMUNITY.minimumUsd);
  });

  it("BUSINESS: small group hits the minimum floor", () => {
    const q = priceFor("BUSINESS", 50);
    expect(q.amountUsd).toBe(PLANS.BUSINESS.minimumUsd);
  });

  it("BUSINESS: per-player scales above floor", () => {
    const playersAboveFloor = Math.ceil(PLANS.BUSINESS.minimumUsd / PLANS.BUSINESS.pricePerPlayerUsd) + 10;
    const q = priceFor("BUSINESS", playersAboveFloor);
    expect(q.amountUsd).toBe(playersAboveFloor * PLANS.BUSINESS.pricePerPlayerUsd);
  });

  it("ARS rate falls back to default when env missing", () => {
    delete env.USD_TO_ARS_RATE;
    const q = priceFor("PERSONAL_PLUS", 0);
    expect(q.arsRate).toBeGreaterThan(0);
  });
});

describe("resolveLimits", () => {
  it("returns the maxPlayers from PLANS for each plan", () => {
    expect(resolveLimits("FREE").maxPlayers).toBe(PLANS.FREE.maxPlayers);
    expect(resolveLimits("BUSINESS").maxPlayers).toBe(PLANS.BUSINESS.maxPlayers);
  });
});

// ----------------------------------------------------------------------------
// group-policy.ts
// ----------------------------------------------------------------------------

describe("canJoinGroup", () => {
  it("allows join when ACTIVE and under capacity", () => {
    const r = canJoinGroup({ status: "ACTIVE", participantLimit: 10 }, 5);
    expect(r.ok).toBe(true);
  });

  it("blocks join when status is PENDING_PAYMENT", () => {
    const r = canJoinGroup({ status: "PENDING_PAYMENT", participantLimit: 10 }, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.reason.toLowerCase()).toContain("pago");
    }
  });

  it("blocks join when CANCELLED", () => {
    const r = canJoinGroup({ status: "CANCELLED", participantLimit: 10 }, 0);
    expect(r.ok).toBe(false);
  });

  it("blocks join when PAYMENT_REVERSED (refund/chargeback)", () => {
    const r = canJoinGroup({ status: "PAYMENT_REVERSED", participantLimit: 10 }, 0);
    expect(r.ok).toBe(false);
  });

  it("blocks join when at capacity", () => {
    const r = canJoinGroup({ status: "ACTIVE", participantLimit: 10 }, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("blocks join when over capacity", () => {
    const r = canJoinGroup({ status: "ACTIVE", participantLimit: 10 }, 11);
    expect(r.ok).toBe(false);
  });
});

describe("canEditGroup", () => {
  it("allows the creator to edit", () => {
    const r = canEditGroup({
      group: { createdById: "user-1", organizationId: null },
      userId: "user-1",
    });
    expect(r.ok).toBe(true);
  });

  it("blocks non-creator non-org-member", () => {
    const r = canEditGroup({
      group: { createdById: "user-1", organizationId: null },
      userId: "user-2",
    });
    expect(r.ok).toBe(false);
  });

  it("allows org OWNER even if not the creator", () => {
    const r = canEditGroup({
      group: { createdById: "user-1", organizationId: "org-1" },
      userId: "user-2",
      orgRole: "OWNER",
    });
    expect(r.ok).toBe(true);
  });

  it("blocks org PLAYER role", () => {
    const r = canEditGroup({
      group: { createdById: "user-1", organizationId: "org-1" },
      userId: "user-2",
      orgRole: "PLAYER",
    });
    expect(r.ok).toBe(false);
  });
});

describe("canViewBilling", () => {
  it("allows creator", () => {
    const r = canViewBilling({
      group: { createdById: "user-1", organizationId: null },
      userId: "user-1",
    });
    expect(r.ok).toBe(true);
  });

  it("blocks org ADMIN (only OWNER can view billing)", () => {
    const r = canViewBilling({
      group: { createdById: "creator", organizationId: "org-1" },
      userId: "admin",
      orgRole: "ADMIN",
    });
    expect(r.ok).toBe(false);
  });

  it("allows org OWNER", () => {
    const r = canViewBilling({
      group: { createdById: "creator", organizationId: "org-1" },
      userId: "owner",
      orgRole: "OWNER",
    });
    expect(r.ok).toBe(true);
  });
});

describe("isAtCapacity", () => {
  it("true when count == limit", () => {
    expect(isAtCapacity({ participantLimit: 5 }, 5)).toBe(true);
  });
  it("true when count > limit", () => {
    expect(isAtCapacity({ participantLimit: 5 }, 6)).toBe(true);
  });
  it("false when below limit", () => {
    expect(isAtCapacity({ participantLimit: 5 }, 4)).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// flags — triple gate
// ----------------------------------------------------------------------------

describe("canPlayersBeCharged — triple gate", () => {
  beforeEach(() => {
    resetEnv();
    delete env.ENABLE_REAL_MONEY_POOLS;
    delete env.ENABLE_PLAYER_PAYMENTS;
    delete env.LEGAL_REAL_MONEY_POOLS_APPROVED;
    env.NODE_ENV = "production";
  });
  afterEach(() => resetEnv());

  it("default = false (all three flags off in prod)", () => {
    expect(canPlayersBeCharged()).toBe(false);
  });

  it("returns false if only ENABLE_REAL_MONEY_POOLS is true", () => {
    env.ENABLE_REAL_MONEY_POOLS = "true";
    expect(canPlayersBeCharged()).toBe(false);
  });

  it("returns false if only ENABLE_PLAYER_PAYMENTS is true", () => {
    env.ENABLE_PLAYER_PAYMENTS = "true";
    expect(canPlayersBeCharged()).toBe(false);
  });

  it("returns false if missing legal approval", () => {
    env.ENABLE_REAL_MONEY_POOLS = "true";
    env.ENABLE_PLAYER_PAYMENTS = "true";
    expect(canPlayersBeCharged()).toBe(false);
  });

  it("returns true ONLY when all three are explicitly true", () => {
    env.ENABLE_REAL_MONEY_POOLS = "true";
    env.ENABLE_PLAYER_PAYMENTS = "true";
    env.LEGAL_REAL_MONEY_POOLS_APPROVED = "true";
    expect(canPlayersBeCharged()).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// flags — B2B defaults
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// WHITE_LABEL hardening (defense in depth)
// ----------------------------------------------------------------------------

describe("priceFor — WHITE_LABEL hardening", () => {
  it("throws WhiteLabelPricingError instead of returning 0", () => {
    expect(() => priceFor("WHITE_LABEL", 100)).toThrow(WhiteLabelPricingError);
  });

  it("throws regardless of estimatedPlayers", () => {
    expect(() => priceFor("WHITE_LABEL", 0)).toThrow();
    expect(() => priceFor("WHITE_LABEL", 1)).toThrow();
    expect(() => priceFor("WHITE_LABEL", 9999)).toThrow();
  });

  it("isPublicPlan('WHITE_LABEL') is false (UI gate)", () => {
    expect(isPublicPlan("WHITE_LABEL")).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Webhook validation helper (in-process unit, simulates the validator that
// guards GROUP_ACTIVATION metadata before activating a group).
// ----------------------------------------------------------------------------

import type { PlanType } from "@prisma/client";
function validateGroupActivationMetadata(
  metadata: unknown,
): { groupId: string; planType: PlanType } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.groupId !== "string" || !m.groupId) return null;
  if (typeof m.planType !== "string") return null;
  if (!(m.planType in PLANS)) return null;
  const planType = m.planType as PlanType;
  if (!isPublicPlan(planType)) return null;
  return { groupId: m.groupId, planType };
}

describe("webhook GROUP_ACTIVATION metadata validator", () => {
  it("accepts valid PERSONAL_PLUS metadata", () => {
    const r = validateGroupActivationMetadata({ groupId: "g1", planType: "PERSONAL_PLUS" });
    expect(r).toEqual({ groupId: "g1", planType: "PERSONAL_PLUS" });
  });

  it("accepts COMMUNITY and BUSINESS", () => {
    expect(validateGroupActivationMetadata({ groupId: "g", planType: "COMMUNITY" })).toBeTruthy();
    expect(validateGroupActivationMetadata({ groupId: "g", planType: "BUSINESS" })).toBeTruthy();
  });

  it("rejects WHITE_LABEL even with valid groupId", () => {
    const r = validateGroupActivationMetadata({ groupId: "g1", planType: "WHITE_LABEL" });
    expect(r).toBeNull();
  });

  it("rejects when groupId is missing", () => {
    expect(validateGroupActivationMetadata({ planType: "PERSONAL_PLUS" })).toBeNull();
  });

  it("rejects when planType is missing", () => {
    expect(validateGroupActivationMetadata({ groupId: "g1" })).toBeNull();
  });

  it("rejects unknown planType", () => {
    expect(validateGroupActivationMetadata({ groupId: "g1", planType: "ENTERPRISE_DOOM" })).toBeNull();
  });

  it("rejects null/undefined metadata", () => {
    expect(validateGroupActivationMetadata(null)).toBeNull();
    expect(validateGroupActivationMetadata(undefined)).toBeNull();
  });

  it("rejects empty groupId string", () => {
    expect(validateGroupActivationMetadata({ groupId: "", planType: "COMMUNITY" })).toBeNull();
  });

  it("rejects non-string groupId/planType", () => {
    expect(validateGroupActivationMetadata({ groupId: 123, planType: "FREE" })).toBeNull();
    expect(validateGroupActivationMetadata({ groupId: "g1", planType: 123 })).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// Real-money pool flag block (documented behavior)
// ----------------------------------------------------------------------------

describe("real-money pool flag block", () => {
  const env = process.env as Record<string, string | undefined>;
  const original = { ...env };
  beforeEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
    env.NODE_ENV = "production";
    delete env.ENABLE_REAL_MONEY_POOLS;
  });
  afterEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
  });

  it("flag defaults OFF in prod", () => {
    expect(flags.enableRealMoneyPools()).toBe(false);
  });

  it("can be flipped ON via env", () => {
    env.ENABLE_REAL_MONEY_POOLS = "true";
    expect(flags.enableRealMoneyPools()).toBe(true);
  });
});

describe("B2B feature flag defaults", () => {
  beforeEach(() => {
    resetEnv();
    delete env.ENABLE_B2B_ORGANIZERS;
    delete env.ENABLE_PERSONAL_GROUPS;
    delete env.ENABLE_ORGANIZATION_PLANS;
    env.NODE_ENV = "production";
  });
  afterEach(() => resetEnv());

  it("B2B/personal/org plans default ON in prod", () => {
    expect(flags.enableB2bOrganizers()).toBe(true);
    expect(flags.enablePersonalGroups()).toBe(true);
    expect(flags.enableOrganizationPlans()).toBe(true);
  });

  it("real-money pools still default OFF in prod", () => {
    delete env.ENABLE_REAL_MONEY_POOLS;
    expect(flags.enableRealMoneyPools()).toBe(false);
  });
});
