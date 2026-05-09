/**
 * CheckBall logo invariants — file-level checks (no DOM render).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CHECKBALL_TOKENS } from "@/components/CheckBallLogo";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("CheckBallLogo — token invariants", () => {
  it("tokens match brand exploration", () => {
    expect(CHECKBALL_TOKENS.green).toBe("#10B981");
    expect(CHECKBALL_TOKENS.navy).toBe("#0B1220");
    expect(CHECKBALL_TOKENS.gold).toBe("#F5B82E");
  });
});

describe("CheckBallLogo — component shape", () => {
  const file = read("src/components/CheckBallLogo.tsx");
  it("exports CheckBallLogo + default", () => {
    expect(file).toMatch(/export\s+function\s+CheckBallLogo/);
    expect(file).toMatch(/export\s+default\s+CheckBallLogo/);
  });
  it("includes pentagon + check + pivot SVG paths", () => {
    expect(file).toMatch(/M48 22 L70 38/); // pentagon
    expect(file).toMatch(/M40 50 L50 60 L78 30/); // check
    expect(file).toMatch(/<circle cx="48" cy="42"/); // pivot
  });
  it("accepts size, bg, accent, gold props", () => {
    expect(file).toMatch(/size\s*=\s*96/);
    expect(file).toMatch(/bg\s*=\s*CHECKBALL_TOKENS\.navy/);
  });
  it("has aria-label for accessibility", () => {
    expect(file).toMatch(/aria-label/);
    expect(file).toMatch(/role="img"/);
  });
});

describe("LoginScreen uses CheckBallLogo (not soccer ball emoji)", () => {
  const file = read("src/components/screens/LoginScreen.tsx");
  it("imports CheckBallLogo", () => {
    expect(file).toMatch(/import\s+\{\s*CheckBallLogo\s*\}/);
  });
  it("uses <CheckBallLogo .../>", () => {
    expect(file).toMatch(/<CheckBallLogo\s/);
  });
  it("does NOT contain ⚽ emoji as brand mark", () => {
    expect(file).not.toMatch(/⚽/);
  });
});

describe("JoinGroupScreen uses CheckBallLogo at the top", () => {
  const file = read("src/components/screens/JoinGroupScreen.tsx");
  it("imports CheckBallLogo", () => {
    expect(file).toMatch(/import\s+\{\s*CheckBallLogo\s*\}/);
  });
  it("renders <CheckBallLogo .../> in the brand block", () => {
    expect(file).toMatch(/<CheckBallLogo\s/);
  });
});

describe("App icon files registered with Next.js conventions", () => {
  it("app/icon.svg exists with squircle navy + check colors", () => {
    const file = read("src/app/icon.svg");
    expect(file).toMatch(/fill="#0B1220"/); // navy squircle
    expect(file).toMatch(/stroke="#10B981"/); // green pentagon
    expect(file).toMatch(/stroke="#F5B82E"/); // gold check
  });
  it("app/apple-icon.tsx exists with 180×180 PNG export", () => {
    const file = read("src/app/apple-icon.tsx");
    expect(file).toMatch(/width:\s*180/);
    expect(file).toMatch(/contentType\s*=\s*"image\/png"/);
    expect(file).toMatch(/ImageResponse/);
  });
});
