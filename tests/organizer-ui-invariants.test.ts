/**
 * UI invariant tests — read source files to assert that the wizard/list/join
 * screens do NOT contain copy or options that violate the model:
 *   - WHITE_LABEL never offered in public UI
 *   - "pozo" / "apuesta" not present in standard organizer screens
 *   - hasPool/entryFee not sent from /organizer wizard
 *   - JoinGroupScreen renders pozo block only when enableRealMoneyPools
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("/organizer/create wizard invariants", () => {
  const file = read("src/app/organizer/create/page.tsx");

  it("does NOT offer WHITE_LABEL as a plan option", () => {
    expect(file).not.toMatch(/value:\s*"WHITE_LABEL"/);
    // Only inspect non-comment code lines for the literal "WHITE_LABEL"
    const codeLines = file
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(codeLines).not.toMatch(/"WHITE_LABEL"/);
  });

  it("does NOT send hasPool or entryFee in the create payload", () => {
    expect(file).not.toMatch(/hasPool\s*:/);
    expect(file).not.toMatch(/entryFee\s*:/);
  });

  it("PERSONAL plan options only include FREE and PERSONAL_PLUS", () => {
    const personalBlock = file.match(/PERSONAL_PLAN_OPTIONS[\s\S]*?\];/)?.[0] ?? "";
    expect(personalBlock).toContain('"FREE"');
    expect(personalBlock).toContain('"PERSONAL_PLUS"');
    expect(personalBlock).not.toContain('"COMMUNITY"');
    expect(personalBlock).not.toContain('"BUSINESS"');
    expect(personalBlock).not.toContain('"WHITE_LABEL"');
  });

  it("ORGANIZATION plan options only include COMMUNITY and BUSINESS", () => {
    const orgBlock = file.match(/ORG_PLAN_OPTIONS[\s\S]*?\];/)?.[0] ?? "";
    expect(orgBlock).toContain('"COMMUNITY"');
    expect(orgBlock).toContain('"BUSINESS"');
    expect(orgBlock).not.toContain('"FREE"');
    expect(orgBlock).not.toContain('"PERSONAL_PLUS"');
    expect(orgBlock).not.toContain('"WHITE_LABEL"');
  });

  it("FREE path goes to /organizer (no MP redirect)", () => {
    expect(file).toMatch(/window\.location\.href = "\/organizer"/);
  });

  it("Premium path uses createActivationPayment + initPoint redirect", () => {
    expect(file).toMatch(/createActivationPayment/);
    expect(file).toMatch(/window\.location\.href = initPoint/);
  });

  it("Includes the disclaimer about no automatic money distribution", () => {
    expect(file).toMatch(/no reparte dinero autom[aá]ticamente/);
  });
});

describe("JoinGroupScreen — no legacy pozo copy by default", () => {
  const file = read("src/components/screens/JoinGroupScreen.tsx");

  it("does NOT mention 'Entrada por persona' as plain text", () => {
    expect(file).not.toMatch(/Entrada por persona/);
  });

  it("does NOT mention 'contribuir al pozo'", () => {
    expect(file).not.toMatch(/contribuir al pozo/i);
  });

  it("uses 'Jugar es gratis para invitados' or similar copy", () => {
    expect(file).toMatch(/gratis para invitados/i);
  });

  it("renders the legacy pool block only behind enableRealMoneyPools flag", () => {
    // The pool block must be inside a conditional that includes the flag.
    expect(file).toMatch(/config\.flags\.enableRealMoneyPools[\s&]+groupInfo\.hasPool/);
  });

  it("blocks join when status is not ACTIVE", () => {
    expect(file).toMatch(/STATUS_BLOCK_MESSAGE/);
    expect(file).toMatch(/PENDING_PAYMENT/);
    expect(file).toMatch(/PAYMENT_REVERSED/);
  });

  it("shows organization branding when present", () => {
    expect(file).toMatch(/organization\.logoUrl/);
    expect(file).toMatch(/Organizado por/);
  });

  it("shows manual prize when prizeDescription is set", () => {
    expect(file).toMatch(/prizeDescription/);
  });
});

describe("/organizer list — no legacy fields exposed", () => {
  const file = read("src/app/organizer/page.tsx");

  it("does NOT show pozo/entryFee/hasPool labels", () => {
    expect(file).not.toMatch(/Pozo /);
    expect(file).not.toMatch(/entryFee/);
    expect(file).not.toMatch(/hasPool/);
  });

  it("uses status label map and tone colors", () => {
    expect(file).toMatch(/STATUS_LABEL/);
    expect(file).toMatch(/PENDING_PAYMENT/);
    expect(file).toMatch(/Pago revertido/);
  });
});

describe("group-policy reason text", () => {
  const file = read("src/lib/group-policy.ts");

  it("does NOT mention pozo in capacity message", () => {
    expect(file).not.toMatch(/Pozo lleno/);
    expect(file).toMatch(/Cupo lleno/);
  });
});
