/**
 * Sprint 2 B+C — file-level invariants for Manual Pool + Player Premium.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { priceForPool, priceForPlayerPremium, getPlayerPremiumPriceUsd } from "@/lib/plans";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("priceForPlayerPremium", () => {
  it("default price is USD 2", () => {
    expect(getPlayerPremiumPriceUsd()).toBe(2);
  });
  it("returns USD + ARS quote", () => {
    const q = priceForPlayerPremium();
    expect(q.amountUsd).toBeGreaterThan(0);
    expect(q.amountArs).toBeGreaterThan(0);
    expect(q.arsRate).toBeGreaterThan(0);
  });
});

describe("priceForPool default config still works after Sprint 2", () => {
  it("0 pool → USD 5 floor", () => {
    expect(priceForPool(0).amountUsd).toBe(5);
  });
  it("does not crash on negative", () => {
    expect(priceForPool(-100).amountUsd).toBe(5);
  });
});

describe("Pool tracking endpoint exists with correct gates", () => {
  const file = read("src/app/api/groups/[id]/pool-tracking/route.ts");
  it("checks enableManualPools flag", () => {
    expect(file).toMatch(/flags\.enableManualPools\(\)/);
  });
  it("rejects when group is not MANUAL_POOL", () => {
    expect(file).toMatch(/moneyMode !== "MANUAL_POOL"/);
  });
  it("uses canEditGroup policy", () => {
    expect(file).toMatch(/canEditGroup/);
  });
  it("upserts via groupId_userId unique key", () => {
    expect(file).toMatch(/groupId_userId/);
  });
  it("never writes to PoolContribution (legacy)", () => {
    expect(file).not.toMatch(/poolContribution/);
  });
});

describe("Wizard step ¿hay pozo? wired correctly", () => {
  const file = read("src/app/organizer/create/page.tsx");
  it("uses enableManualPools from public config", () => {
    expect(file).toMatch(/manualPoolsEnabled/);
  });
  it("only sends moneyMode when organizer opted in", () => {
    expect(file).toMatch(/moneyMode:\s*"MANUAL_POOL"/);
  });
  it("calculates dynamic fee USD 5 + 7% with cap 400", () => {
    expect(file).toMatch(/FEE_BASE_USD = 5/);
    expect(file).toMatch(/FEE_PCT = 0\.07/);
    expect(file).toMatch(/FEE_CAP_USD = 400/);
  });
});

describe("JoinGroupScreen — Manual Pool block gated", () => {
  const file = read("src/components/screens/JoinGroupScreen.tsx");
  it("only renders when enableManualPools AND moneyMode is MANUAL_POOL", () => {
    expect(file).toMatch(/enableManualPools/);
    expect(file).toMatch(/moneyMode === "MANUAL_POOL"/);
  });
  it("contains 'no procesa este dinero' disclaimer", () => {
    expect(file).toMatch(/no\s+procesa\s+este\s+dinero/i);
  });
});

describe("Player Premium — payment plumbing", () => {
  const flagsFile = read("src/lib/flags.ts");
  const paymentsFile = read("src/app/api/payments/create/route.ts");
  const webhookFile = read("src/app/api/webhooks/mercadopago/route.ts");
  const premiumApi = read("src/app/api/users/premium/route.ts");

  it("flag enablePlayerPremium exists, default OFF", () => {
    expect(flagsFile).toMatch(/enablePlayerPremium/);
    expect(flagsFile).toMatch(/ENABLE_PLAYER_PREMIUM/);
  });
  it("payments/create accepts type=player_premium", () => {
    expect(paymentsFile).toMatch(/type === "player_premium"/);
    expect(paymentsFile).toMatch(/paymentType = "PLAYER_PREMIUM"/);
  });
  it("payments/create rejects double-buy with 409", () => {
    expect(paymentsFile).toMatch(/Ya tenés Premium activo/);
  });
  it("webhook handles approved PLAYER_PREMIUM and creates membership", () => {
    expect(webhookFile).toMatch(/order\.type === "PLAYER_PREMIUM"/);
    expect(webhookFile).toMatch(/premiumMembership\.upsert/);
    expect(webhookFile).toMatch(/approved_player_premium/);
  });
  it("GET /api/users/premium returns isPremium flag + memberships", () => {
    expect(premiumApi).toMatch(/isPremium:/);
    expect(premiumApi).toMatch(/validUntil:\s*{\s*gt:\s*new Date\(\)/);
  });
});

describe("Player Premium — UI", () => {
  const premiumPage = read("src/app/premium/page.tsx");
  const profile = read("src/components/screens/ProfileScreen.tsx");
  const home = read("src/components/screens/HomeScreen.tsx");

  it("/premium page shows USD 2 price + benefits + 'No es apuesta'", () => {
    expect(premiumPage).toMatch(/USD \{PREMIUM_PRICE_USD\}/);
    expect(premiumPage).toMatch(/PREMIUM_PRICE_USD = 2/);
    expect(premiumPage).toMatch(/No es apuesta/i);
  });
  it("/premium page uses useBuyPlayerPremium + redirect to MP", () => {
    expect(premiumPage).toMatch(/useBuyPlayerPremium/);
    expect(premiumPage).toMatch(/window\.location\.href = initPoint/);
  });
  it("ProfileScreen shows PREMIUM badge when isPremium", () => {
    expect(profile).toMatch(/usePlayerPremium/);
    expect(profile).toMatch(/PREMIUM/);
  });
  it("HomeScreen shows premium banner only when flag on AND not premium", () => {
    expect(home).toMatch(/enablePlayerPremium/);
    expect(home).toMatch(/!isPremium/);
  });
});

describe("Terms updated for B + C", () => {
  const file = read("src/app/terms/page.tsx");
  it("mentions Pozo declarado as optional", () => {
    expect(file).toMatch(/Pozo declarado/i);
  });
  it("mentions Premium for players as optional software", () => {
    expect(file).toMatch(/Suscripcion Premium para jugadores/);
  });
  it("re-states no es apuesta clearly for both", () => {
    expect(file).toMatch(/No es apuesta ni juego de azar/);
  });
});
