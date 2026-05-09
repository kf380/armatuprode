/**
 * Invariants for /organizer/[id] dashboard:
 *  - never shows hasPool/entryFee/POZO ACUMULADO
 *  - never references player payments / POOL_ENTRY
 *  - uses prize-manual + organizer-pays language
 *  - tabs match the spec (Resumen, Jugadores, Config, Billing)
 *  - reuses canViewBilling / canResumePayment policy gates
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("/organizer/[id] page — money capsule must remain off", () => {
  const file = read("src/app/organizer/[id]/page.tsx");

  it("does NOT render hasPool, entryFee, or POOL_ENTRY anywhere", () => {
    expect(file).not.toMatch(/hasPool/);
    expect(file).not.toMatch(/entryFee/);
    expect(file).not.toMatch(/POOL_ENTRY/);
    expect(file).not.toMatch(/PoolContribution/);
  });

  it("does NOT call payments/create with type=pool_entry", () => {
    expect(file).not.toMatch(/pool_entry/);
  });

  it("does NOT contain prohibited copy: pozo acumulado / apostá / cashout / entry fee / reparto automático", () => {
    expect(file).not.toMatch(/POZO ACUMULADO/i);
    expect(file).not.toMatch(/apost[aá]/i);
    expect(file).not.toMatch(/cashout/i);
    expect(file).not.toMatch(/entry fee/i);
    expect(file).not.toMatch(/reparto autom[aá]tico/i);
    expect(file).not.toMatch(/gan[aá] plata/i);
  });

  it("contains the disclaimer about no automatic money distribution", () => {
    expect(file).toMatch(/no\s+custodia\s+ni\s+reparte|no\s+reparte\s+dinero/i);
  });

  it("uses 'jugadores invitados entran gratis' or equivalent", () => {
    expect(file).toMatch(/invitados entran gratis|no cobra a jugadores/i);
  });
});

describe("/organizer/[id] page — tab structure", () => {
  const file = read("src/app/organizer/[id]/page.tsx");

  it("declares 4 tabs", () => {
    expect(file).toMatch(/key:\s*"resumen"/);
    expect(file).toMatch(/key:\s*"jugadores"/);
    expect(file).toMatch(/key:\s*"config"/);
    expect(file).toMatch(/key:\s*"billing"/);
  });

  it("tab Billing gates on canViewBilling permission", () => {
    expect(file).toMatch(/permissions\.canViewBilling/);
  });

  it("tab Billing gates retry button on canResumePayment", () => {
    expect(file).toMatch(/permissions\.canResumePayment/);
  });

  it("redirects to login if not signed in", () => {
    expect(file).toMatch(/next=\/organizer\/\$\{id\}/);
  });

  it("blocks non-creators with a permission message", () => {
    expect(file).toMatch(/permissions\.canEdit/);
    expect(file).toMatch(/Solo el creador/);
  });
});

describe("/organizer/[id] page — payment retry path", () => {
  const file = read("src/app/organizer/[id]/page.tsx");

  it("uses /api/groups/[id]/resume-payment via useResumeGroupPayment hook", () => {
    expect(file).toMatch(/useResumeGroupPayment/);
  });

  it("handles PENDING_PAYMENT_OPEN warn response with minutesLeft hint", () => {
    expect(file).toMatch(/PENDING_PAYMENT_OPEN/);
    expect(file).toMatch(/minutesLeft/);
  });

  it("retry button only renders for PENDING_PAYMENT / PAYMENT_FAILED / PAYMENT_REVERSED", () => {
    expect(file).toMatch(/PENDING_PAYMENT[\s\S]{0,80}PAYMENT_FAILED[\s\S]{0,80}PAYMENT_REVERSED/);
  });
});
