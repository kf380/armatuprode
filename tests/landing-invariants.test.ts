/**
 * /landing public page invariants:
 *  - sections present (Hero / How / For-who / Includes / Disclaimer / CTA)
 *  - language: free for invited players, manual prize, organizer-pays
 *  - no betting/cashout/pool copy
 *  - CTAs go to /organizer/create
 *  - links to /terms and /privacy
 *  - CheckBallLogo used
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("/landing — section presence", () => {
  const file = read("src/app/landing/page.tsx");

  it("has hero title 'Armá tu prode en minutos'", () => {
    expect(file).toMatch(/Arm[aá] tu prode en minutos/);
  });

  it("has 'cómo funciona' section with three numbered steps", () => {
    expect(file).toMatch(/CÓMO FUNCIONA/i);
    expect(file).toMatch(/n:\s*"01"/);
    expect(file).toMatch(/n:\s*"02"/);
    expect(file).toMatch(/n:\s*"03"/);
  });

  it("has 'para quién es' section with at least 4 audience cards", () => {
    expect(file).toMatch(/PARA QUIÉN ES/i);
    expect(file).toMatch(/Amigos y familia/);
    expect(file).toMatch(/Bares y comunidades/);
    expect(file).toMatch(/Empresas y equipos/);
    expect(file).toMatch(/Streamers/);
  });

  it("has 'qué incluye' section", () => {
    expect(file).toMatch(/QUÉ INCLUYE/i);
    expect(file).toMatch(/Ranking privado/);
    expect(file).toMatch(/Link de invitación/);
    expect(file).toMatch(/Premio manual/);
    expect(file).toMatch(/Reglas personalizadas/);
    expect(file).toMatch(/Dashboard del organizador/);
    expect(file).toMatch(/Billing del organizador/);
  });

  it("has aclaración importante section with 'no es una casa de apuestas'", () => {
    expect(file).toMatch(/ACLARACIÓN IMPORTANTE/i);
    expect(file).toMatch(/no es una casa de apuestas/i);
  });

  it("has final CTA 'Creá tu primer prode gratis'", () => {
    expect(file).toMatch(/Cre[aá] tu primer prode gratis/);
  });
});

describe("/landing — copy invariants (no betting language)", () => {
  const file = read("src/app/landing/page.tsx");

  it("does NOT use prohibited betting language", () => {
    expect(file).not.toMatch(/apost[aá]/i);
    expect(file).not.toMatch(/gan[aá] plata/i);
    expect(file).not.toMatch(/cashout/i);
    expect(file).not.toMatch(/entry fee/i);
    expect(file).not.toMatch(/pozo acumulado/i);
    expect(file).not.toMatch(/reparto autom[aá]tico/i);
    // Must mention "casa de apuestas" only as a negation
    const codeOnly = file
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(codeOnly).not.toMatch(/\bcasino\b/i);
  });

  it("uses required positive copy", () => {
    expect(file).toMatch(/jugadores.*entran gratis|invitados entran gratis/i);
    expect(file).toMatch(/premio.*manual/i);
    expect(file).toMatch(/ranking privado/i);
    expect(file).toMatch(/organizador gestiona/i);
  });

  it("does NOT mention player payments / pools / POOL_ENTRY", () => {
    expect(file).not.toMatch(/POOL_ENTRY/);
    expect(file).not.toMatch(/pool_entry/);
    expect(file).not.toMatch(/PoolContribution/);
    expect(file).not.toMatch(/hasPool/);
    expect(file).not.toMatch(/entryFee/);
  });

  it("explicitly states no auto money distribution / no custody", () => {
    expect(file).toMatch(/no\s+custodia\s+ni\s+reparte/i);
  });
});

describe("/landing — CTAs and links", () => {
  const file = read("src/app/landing/page.tsx");

  it("primary CTA goes to /organizer/create", () => {
    const occurrences = file.match(/href="\/organizer\/create"/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2); // header + hero + final CTA
  });

  it("'Ver cómo funciona' CTA points to #como-funciona anchor", () => {
    expect(file).toMatch(/href="#como-funciona"/);
    expect(file).toMatch(/id="como-funciona"/);
  });

  it("links to /terms and /privacy (legal compliance)", () => {
    expect(file).toMatch(/href="\/terms"/);
    expect(file).toMatch(/href="\/privacy"/);
  });

  it("uses CheckBallLogo as brand mark", () => {
    expect(file).toMatch(/import\s+\{\s*CheckBallLogo\s*\}/);
    expect(file).toMatch(/<CheckBallLogo\s/);
  });

  it("uses Next <Link> for internal navigation (App Router best practice)", () => {
    expect(file).toMatch(/import Link from "next\/link"/);
  });
});

describe("/landing — metadata for SEO/social shares", () => {
  const file = read("src/app/landing/page.tsx");

  it("exports metadata with title and description", () => {
    expect(file).toMatch(/export const metadata/);
    expect(file).toMatch(/title:.*Arm[aá] tu prode/i);
    expect(file).toMatch(/description:/);
  });

  it("includes openGraph for social shares", () => {
    expect(file).toMatch(/openGraph:/);
  });
});

describe("LoginScreen — link to /landing for anon visitors with no context", () => {
  const file = read("src/components/screens/LoginScreen.tsx");

  it("includes a 'Ver cómo funciona' link to /landing", () => {
    expect(file).toMatch(/href="\/landing"/);
    expect(file).toMatch(/Ver c[oó]mo funciona/);
  });
});
