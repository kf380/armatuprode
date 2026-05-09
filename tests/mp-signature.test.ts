import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { validateWebhookSignature } from "@/lib/mercadopago";

const SECRET = "test-secret-abc";

function signManifest(secret: string, dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("validateWebhookSignature", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalEnv = env.MP_WEBHOOK_SECRET;
  const originalNodeEnv = env.NODE_ENV;

  beforeEach(() => {
    env.MP_WEBHOOK_SECRET = SECRET;
    env.NODE_ENV = "production";
  });

  afterEach(() => {
    env.MP_WEBHOOK_SECRET = originalEnv;
    env.NODE_ENV = originalNodeEnv;
  });

  it("accepts a valid signature", () => {
    const ts = "1700000000";
    const sig = signManifest(SECRET, "12345", "req-abc", ts);
    expect(validateWebhookSignature(sig, "req-abc", "12345")).toBe(true);
  });

  it("rejects a tampered signature", () => {
    const ts = "1700000000";
    const sig = signManifest("WRONG-SECRET", "12345", "req-abc", ts);
    expect(validateWebhookSignature(sig, "req-abc", "12345")).toBe(false);
  });

  it("rejects when dataId differs from signed manifest", () => {
    const ts = "1700000000";
    const sig = signManifest(SECRET, "12345", "req-abc", ts);
    expect(validateWebhookSignature(sig, "req-abc", "99999")).toBe(false);
  });

  it("rejects when requestId differs", () => {
    const ts = "1700000000";
    const sig = signManifest(SECRET, "12345", "req-abc", ts);
    expect(validateWebhookSignature(sig, "req-xyz", "12345")).toBe(false);
  });

  it("rejects missing signature header", () => {
    expect(validateWebhookSignature(null, "req-abc", "12345")).toBe(false);
  });

  it("rejects missing requestId", () => {
    const sig = signManifest(SECRET, "12345", "req-abc", "1700000000");
    expect(validateWebhookSignature(sig, null, "12345")).toBe(false);
  });

  it("rejects missing dataId", () => {
    const sig = signManifest(SECRET, "12345", "req-abc", "1700000000");
    expect(validateWebhookSignature(sig, "req-abc", null)).toBe(false);
  });

  it("rejects malformed signature header", () => {
    expect(validateWebhookSignature("garbage", "req-abc", "12345")).toBe(false);
    expect(validateWebhookSignature("v1=onlyhash", "req-abc", "12345")).toBe(false);
  });

  it("fails closed in production when MP_WEBHOOK_SECRET missing", () => {
    delete process.env.MP_WEBHOOK_SECRET;
    const sig = signManifest("any", "12345", "req-abc", "1700000000");
    expect(validateWebhookSignature(sig, "req-abc", "12345")).toBe(false);
  });

  it("allows in non-prod when secret missing (dev convenience)", () => {
    delete env.MP_WEBHOOK_SECRET;
    env.NODE_ENV = "development";
    expect(validateWebhookSignature("anything", "req-abc", "12345")).toBe(true);
  });
});
