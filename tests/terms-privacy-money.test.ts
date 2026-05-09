/**
 * Terms & Privacy must reflect the current product (NONE money mode):
 *  - no presenting cash pools as an active feature
 *  - explicit disclaimer that the platform doesn't process / custody / split prizes
 *  - no "apuesta" framing
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("terms — money model alignment", () => {
  const file = read("src/app/terms/page.tsx");

  it("does NOT promise pozos de grupo as an active feature", () => {
    expect(file).not.toMatch(/participar en pozos de premios/i);
    expect(file).not.toMatch(/Los pagos de entradas a pozos se procesan/i);
    expect(file).not.toMatch(/distribucion del pozo/i);
  });

  it("includes 'NO es un sitio de apuestas' clause", () => {
    expect(file).toMatch(/NO es un sitio de apuestas/);
  });

  it("explicitly states ArmaTuProde does not process/custody/distribute pools", () => {
    expect(file).toMatch(/no procesa, custodia ni reparte/i);
  });

  it("section 5 is renamed to 'Premios y planes' (no 'Pozos de grupo')", () => {
    expect(file).toMatch(/Premios y planes del prode/);
    expect(file).not.toMatch(/5\. Pozos de grupo/);
  });

  it("states that invited players don't pay any fee to the platform", () => {
    expect(file).toMatch(/no abonan ningun cargo/i);
  });
});

describe("privacy — money model alignment", () => {
  const file = read("src/app/privacy/page.tsx");

  it("does NOT mention 'entradas a pozos de grupo' as a use case", () => {
    expect(file).not.toMatch(/entradas a pozos de grupo/i);
  });

  it("mentions only plan-pago + coin compras as payment use cases", () => {
    expect(file).toMatch(/planes del organizador/i);
  });
});
