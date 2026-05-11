/**
 * Etapa 6.2 invariant tests.
 *
 * These cover policy logic and source-file invariants without spinning up a
 * real DB. Integration tests for PATCH/resume-payment are handled at smoke-
 * test time (curl) since they require a live group + Supabase token.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { canResumePayment, canEditGroup } from "@/lib/group-policy";
import { PLANS } from "@/lib/plans";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

// ---------------------------------------------------------------------------
// canResumePayment
// ---------------------------------------------------------------------------

describe("canResumePayment", () => {
  const baseGroup = {
    createdById: "creator-1",
    status: "PENDING_PAYMENT" as const,
    planType: "PERSONAL_PLUS" as const,
    isPremium: false,
    billingStatus: null,
  };

  it("allows creator to resume PENDING_PAYMENT", () => {
    const r = canResumePayment({ group: baseGroup, userId: "creator-1" });
    expect(r.ok).toBe(true);
  });

  it("allows creator to resume PAYMENT_FAILED", () => {
    const r = canResumePayment({
      group: { ...baseGroup, status: "PAYMENT_FAILED" },
      userId: "creator-1",
    });
    expect(r.ok).toBe(true);
  });

  it("allows creator to resume PAYMENT_REVERSED", () => {
    const r = canResumePayment({
      group: { ...baseGroup, status: "PAYMENT_REVERSED" },
      userId: "creator-1",
    });
    expect(r.ok).toBe(true);
  });

  it("blocks non-creator", () => {
    const r = canResumePayment({ group: baseGroup, userId: "someone-else" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("blocks FREE plans (no payment needed)", () => {
    const r = canResumePayment({
      group: { ...baseGroup, planType: "FREE" },
      userId: "creator-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("blocks WHITE_LABEL (internal-only)", () => {
    const r = canResumePayment({
      group: { ...baseGroup, planType: "WHITE_LABEL" },
      userId: "creator-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("blocks already-active premium groups (already paid)", () => {
    const r = canResumePayment({
      group: {
        ...baseGroup,
        status: "ACTIVE",
        isPremium: true,
        billingStatus: "PAID",
      },
      userId: "creator-1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("blocks DRAFT/PAUSED/FINISHED/CANCELLED states", () => {
    for (const status of ["DRAFT", "PAUSED", "FINISHED", "CANCELLED", "ACTIVE"] as const) {
      const r = canResumePayment({
        group: { ...baseGroup, status },
        userId: "creator-1",
      });
      expect(r.ok).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// canEditGroup (already exists, but verify the policy sticks for PATCH)
// ---------------------------------------------------------------------------

describe("canEditGroup vs PATCH-blocked terminal states", () => {
  it("allows creator on ACTIVE/PAUSED/PENDING_PAYMENT", () => {
    const g = { createdById: "u1", organizationId: null };
    expect(canEditGroup({ group: g, userId: "u1" }).ok).toBe(true);
  });

  it("rejects non-creator non-org", () => {
    const g = { createdById: "u1", organizationId: null };
    expect(canEditGroup({ group: g, userId: "u2" }).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Source file invariants — endpoints exist + handle policy correctly
// ---------------------------------------------------------------------------

describe("PATCH /api/groups/[id] source invariants", () => {
  const file = read("src/app/api/groups/[id]/route.ts");

  it("exports PATCH handler", () => {
    expect(file).toMatch(/export\s+async\s+function\s+PATCH/);
  });

  it("applies canEditGroup policy", () => {
    expect(file).toMatch(/canEditGroup/);
  });

  it("blocks edits in CANCELLED or FINISHED state", () => {
    expect(file).toMatch(/CANCELLED[\s\S]*FINISHED|FINISHED[\s\S]*CANCELLED/);
  });

  it("does NOT accept hasPool/entryFee/paymentResponsibility/planType/status/isPremium from body destructure", () => {
    // Strip comments first so commented-out field lists don't false-match.
    const patchSection = file.split(/export\s+async\s+function\s+PATCH/)[1] ?? "";
    const stripped = patchSection
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // Locate the body destructure: split by `request.json()` so we skip the
    // unrelated `const { user } = ...` of auth, then capture the LAST const
    // destructure followed by `= body`.
    const afterJson = stripped.split(/request\.json\(\)/)[1] ?? "";
    const destructureMatch = afterJson.match(/const\s*\{([\s\S]*?)\}\s*=\s*body/);
    expect(destructureMatch).toBeTruthy();
    const destructure = destructureMatch?.[1] ?? "";

    expect(destructure).not.toMatch(/\bhasPool\b/);
    expect(destructure).not.toMatch(/\bentryFee\b/);
    expect(destructure).not.toMatch(/\bpaymentResponsibility\b/);
    expect(destructure).not.toMatch(/\bplanType\b/);
    expect(destructure).not.toMatch(/\bisPremium\b/);
    expect(destructure).not.toMatch(/\bbillingStatus\b/);
    expect(destructure).not.toMatch(/\bparticipantLimit\b/);
    expect(destructure).not.toMatch(/\bstatus\b/);
  });

  it("auto-coerces prizeType=NONE if description ends up empty", () => {
    expect(file).toMatch(/finalDescription/);
    expect(file).toMatch(/data\.prizeType\s*=\s*"NONE"/);
  });
});

describe("POST /api/groups/[id]/resume-payment source invariants", () => {
  const file = read("src/app/api/groups/[id]/resume-payment/route.ts");

  it("uses canResumePayment policy", () => {
    expect(file).toMatch(/canResumePayment/);
  });

  it("creates GROUP_ACTIVATION PaymentOrder", () => {
    expect(file).toMatch(/type:\s*"GROUP_ACTIVATION"/);
  });

  it("rejects WHITE_LABEL (via canResumePayment + isPublicPlan)", () => {
    expect(file).toMatch(/isPublicPlan/);
  });

  it("validates plan↔groupType compatibility", () => {
    expect(file).toMatch(/planConfig\.groupType\s*!==\s*group\.type/);
  });

  it("flips PAYMENT_FAILED/PAYMENT_REVERSED back to PENDING_PAYMENT", () => {
    expect(file).toMatch(/PAYMENT_FAILED[\s\S]*PAYMENT_REVERSED|PAYMENT_REVERSED[\s\S]*PAYMENT_FAILED/);
    expect(file).toMatch(/status:\s*"PENDING_PAYMENT"/);
  });

  it("uses MP createMPPreference", () => {
    expect(file).toMatch(/createMPPreference/);
  });

  it("imports and uses classifyPendingOrder for REUSE/WARN/REPLACE branches", () => {
    expect(file).toMatch(/classifyPendingOrder/);
    expect(file).toMatch(/PENDING_PAYMENT_OPEN/);
    expect(file).toMatch(/reused:\s*true/);
    expect(file).toMatch(/replacedBy:\s*"stale_resume"/);
  });

  it("never references POOL_ENTRY or PoolContribution (Phase 1 boundary)", () => {
    expect(file).not.toMatch(/POOL_ENTRY/);
    expect(file).not.toMatch(/PoolContribution/);
  });
});

describe("Webhook GROUP_ACTIVATION cross-validation", () => {
  const file = read("src/app/api/webhooks/mercadopago/route.ts");

  it("validates planType.groupType matches targetGroup.type", () => {
    expect(file).toMatch(/PLANS\[validated\.planType\]\.groupType\s*!==\s*targetGroup\.type/);
  });

  it("rejects order on plan-type mismatch (not silently approves)", () => {
    expect(file).toMatch(/group_activation_plan_type_mismatch/);
  });
});

describe("/api/groups/by-invite gating", () => {
  const file = read("src/app/api/groups/by-invite/[code]/route.ts");

  it("uses canPlayersBeCharged triple gate to expose hasPool/entryFee", () => {
    expect(file).toMatch(/canPlayersBeCharged\(\)/);
    expect(file).not.toMatch(/flags\.enableRealMoneyPools\(\) &&/);
  });

  it("neutralizes hasPool to false when flags are off", () => {
    expect(file).toMatch(/hasPool:\s*false/);
  });
});

describe("triple gate enforcement on player-charging paths", () => {
  it("payments/create pool_entry branch uses canPlayersBeCharged()", () => {
    const file = read("src/app/api/payments/create/route.ts");
    expect(file).toMatch(/type === "pool_entry"[\s\S]{0,200}canPlayersBeCharged\(\)/);
    expect(file).not.toMatch(/type === "pool_entry"[\s\S]{0,200}!flags\.enableRealMoneyPools\(\)/);
  });

  it("groups/route.ts hasPool creation path uses canPlayersBeCharged()", () => {
    const file = read("src/app/api/groups/route.ts");
    expect(file).toMatch(/if \(hasPool\) \{[\s\S]{0,400}canPlayersBeCharged\(\)/);
    expect(file).not.toMatch(/if \(hasPool\) \{[\s\S]{0,200}!flags\.enableRealMoneyPools\(\)/);
  });

  it("GroupsScreen no longer sends hasPool/entryFee to /api/groups", () => {
    const file = read("src/components/screens/GroupsScreen.tsx");
    expect(file).not.toMatch(/hasPool:\s*createGroupType\s*===\s*"pool"/);
    expect(file).not.toMatch(/entryFee:\s*createGroupType\s*===\s*"pool"/);
  });
});

describe("/organizer wizard banner invariant", () => {
  const file = read("src/app/organizer/create/page.tsx");

  it("renders 'No hay torneo activo' banner when tournamentId is missing", () => {
    expect(file).toMatch(/No hay torneo activo/);
    expect(file).toMatch(/!tournamentId/);
  });
});

describe("/organizer filter uses createdById", () => {
  const file = read("src/app/organizer/page.tsx");

  it("filters by createdById, not by role", () => {
    expect(file).toMatch(/g\.createdById\s*===\s*dbUser\.id/);
  });
});

describe("JoinGroupScreen logoUrl onError fallback", () => {
  const file = read("src/components/screens/JoinGroupScreen.tsx");

  it("uses logoFailed state + onError handler", () => {
    expect(file).toMatch(/logoFailed/);
    expect(file).toMatch(/onError=/);
  });
});

// ---------------------------------------------------------------------------
// Plan compatibility table (cross-check what canResumePayment depends on)
// ---------------------------------------------------------------------------

describe("plans compatibility (used by webhook + resume-payment)", () => {
  it("PERSONAL_PLUS is for PERSONAL groups", () => {
    expect(PLANS.PERSONAL_PLUS.groupType).toBe("PERSONAL");
  });
  it("COMMUNITY/BUSINESS are for ORGANIZATION groups", () => {
    expect(PLANS.COMMUNITY.groupType).toBe("ORGANIZATION");
    expect(PLANS.BUSINESS.groupType).toBe("ORGANIZATION");
  });
  it("FREE is for PERSONAL groups", () => {
    expect(PLANS.FREE.groupType).toBe("PERSONAL");
  });
});
