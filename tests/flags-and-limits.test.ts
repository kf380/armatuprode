import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { flags } from "@/lib/flags";
import { limits } from "@/lib/limits";

const env = process.env as Record<string, string | undefined>;
const original = { ...env };

describe("feature flags — fail-closed in production", () => {
  beforeEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
    env.NODE_ENV = "production";
    delete env.ENABLE_REAL_MONEY_POOLS;
    delete env.ENABLE_COIN_SHOP;
    delete env.PUBLIC_LAUNCH_MODE;
  });
  afterEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
  });

  it("real-money pools default OFF in prod", () => {
    expect(flags.enableRealMoneyPools()).toBe(false);
  });
  it("coin shop default OFF in prod", () => {
    expect(flags.enableCoinShop()).toBe(false);
  });
  it("public launch mode defaults to controlled", () => {
    expect(flags.publicLaunchMode()).toBe("controlled");
  });
  it("real-money pools ON when explicitly enabled", () => {
    env.ENABLE_REAL_MONEY_POOLS = "true";
    expect(flags.enableRealMoneyPools()).toBe(true);
  });
  it("coin shop ON when explicitly enabled", () => {
    env.ENABLE_COIN_SHOP = "1";
    expect(flags.enableCoinShop()).toBe(true);
  });
  it("invalid PUBLIC_LAUNCH_MODE falls back to controlled", () => {
    env.PUBLIC_LAUNCH_MODE = "lol";
    expect(flags.publicLaunchMode()).toBe("controlled");
  });
});

describe("feature flags — dev defaults", () => {
  beforeEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
    env.NODE_ENV = "development";
    delete env.ENABLE_REAL_MONEY_POOLS;
    delete env.ENABLE_COIN_SHOP;
  });
  afterEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
  });

  it("real-money pools default ON in dev", () => {
    expect(flags.enableRealMoneyPools()).toBe(true);
  });
  it("coin shop default ON in dev", () => {
    expect(flags.enableCoinShop()).toBe(true);
  });
});

describe("operational limits", () => {
  beforeEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
    delete env.MAX_PUBLIC_USERS;
    delete env.MAX_POOL_PARTICIPANTS;
    delete env.MAX_ENTRY_FEE;
    delete env.MAX_ACTIVE_PAID_GROUPS;
  });
  afterEach(() => {
    for (const k of Object.keys(env)) delete env[k];
    Object.assign(env, original);
  });

  it("returns conservative defaults", () => {
    expect(limits.maxPublicUsers()).toBe(5000);
    expect(limits.maxPoolParticipants()).toBe(50);
    expect(limits.maxEntryFee()).toBe(20000);
    expect(limits.maxActivePaidGroups()).toBe(50);
  });

  it("respects env overrides", () => {
    env.MAX_PUBLIC_USERS = "200";
    env.MAX_POOL_PARTICIPANTS = "20";
    env.MAX_ENTRY_FEE = "10000";
    env.MAX_ACTIVE_PAID_GROUPS = "10";
    expect(limits.maxPublicUsers()).toBe(200);
    expect(limits.maxPoolParticipants()).toBe(20);
    expect(limits.maxEntryFee()).toBe(10000);
    expect(limits.maxActivePaidGroups()).toBe(10);
  });

  it("ignores invalid env values", () => {
    env.MAX_PUBLIC_USERS = "abc";
    expect(limits.maxPublicUsers()).toBe(5000);
  });
});
