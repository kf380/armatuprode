/**
 * Open-redirect guard for the OAuth callback.
 *
 * The handler accepts an arbitrary `?next=X` param after Google login.
 * Without sanitation, an attacker can craft phishing URLs like:
 *   armatuprode.com.ar/api/auth/callback?next=//evil.com
 * which the browser interprets as redirect to evil.com after OAuth.
 *
 * These tests pin the whitelist behavior at the source-code level.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const file = fs.readFileSync(
  path.join(ROOT, "src/app/api/auth/callback/route.ts"),
  "utf8",
);

describe("auth/callback — open-redirect guard", () => {
  it("declares safeNextPath helper", () => {
    expect(file).toMatch(/function safeNextPath/);
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    expect(file).toMatch(/raw\.startsWith\("\/\/"\)/);
  });

  it("rejects backslash attacks (/\\evil.com)", () => {
    expect(file).toMatch(/raw\.startsWith\("\/\\\\"\)/);
  });

  it("rejects absolute http(s) URLs", () => {
    expect(file).toMatch(/\/\^https\?:\\\/\\\/\/i/);
  });

  it("requires path to start with single /", () => {
    expect(file).toMatch(/!raw\.startsWith\("\/"\)/);
  });

  it("caps path length", () => {
    expect(file).toMatch(/raw\.length\s*>\s*512/);
  });

  it("uses safeNextPath before building redirect URL", () => {
    expect(file).toMatch(/const next = safeNextPath/);
  });
});
