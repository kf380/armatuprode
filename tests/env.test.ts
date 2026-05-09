import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateProductionEnv, requireEnv } from "@/lib/env";

const originalEnv = { ...process.env };

describe("validateProductionEnv", () => {
  beforeEach(() => {
    // Reset to a known state
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) delete process.env[k];
    Object.assign(process.env, originalEnv);
  });

  it("noop in non-production", () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    delete process.env.MP_WEBHOOK_SECRET;
    expect(() => validateProductionEnv(true)).not.toThrow();
  });

  it("throws in production when MP_WEBHOOK_SECRET missing", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.DATABASE_URL = "x";
    process.env.DIRECT_URL = "x";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "x";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x";
    process.env.MERCADOPAGO_ACCESS_TOKEN = "x";
    process.env.ADMIN_API_KEY = "x";
    process.env.CRON_SECRET = "x";
    delete process.env.MP_WEBHOOK_SECRET;
    expect(() => validateProductionEnv(true)).toThrow(/MP_WEBHOOK_SECRET/);
  });

  it("throws in production when CRON_SECRET missing", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.DATABASE_URL = "x";
    process.env.DIRECT_URL = "x";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "x";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "x";
    process.env.MERCADOPAGO_ACCESS_TOKEN = "x";
    process.env.MP_WEBHOOK_SECRET = "x";
    process.env.ADMIN_API_KEY = "x";
    delete process.env.CRON_SECRET;
    expect(() => validateProductionEnv(true)).toThrow(/CRON_SECRET/);
  });
});

describe("requireEnv", () => {
  it("returns the value when set", () => {
    process.env.MP_WEBHOOK_SECRET = "yes";
    expect(requireEnv("MP_WEBHOOK_SECRET")).toBe("yes");
  });

  it("throws when missing", () => {
    delete process.env.MP_WEBHOOK_SECRET;
    expect(() => requireEnv("MP_WEBHOOK_SECRET")).toThrow();
  });
});
