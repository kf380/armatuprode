import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isValidAdmin, adminKeyFromRequest } from "@/lib/admin-auth";

const env = process.env as Record<string, string | undefined>;

describe("isValidAdmin", () => {
  const original = env.ADMIN_API_KEY;
  beforeEach(() => {
    env.ADMIN_API_KEY = "super-secret-key-1234567890";
  });
  afterEach(() => {
    env.ADMIN_API_KEY = original;
  });

  it("accepts the exact key", () => {
    expect(isValidAdmin("super-secret-key-1234567890")).toBe(true);
  });

  it("rejects a different key with same length", () => {
    expect(isValidAdmin("super-secret-key-1234567891")).toBe(false);
  });

  it("rejects shorter input", () => {
    expect(isValidAdmin("super-secret")).toBe(false);
  });

  it("rejects longer input", () => {
    expect(isValidAdmin("super-secret-key-1234567890-extra")).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isValidAdmin(null)).toBe(false);
    expect(isValidAdmin(undefined)).toBe(false);
    expect(isValidAdmin("")).toBe(false);
  });

  it("rejects when ADMIN_API_KEY is missing", () => {
    delete env.ADMIN_API_KEY;
    expect(isValidAdmin("anything")).toBe(false);
  });
});

describe("adminKeyFromRequest", () => {
  it("reads Authorization Bearer header", () => {
    const req = new Request("http://x/", {
      headers: { authorization: "Bearer mykey" },
    });
    expect(adminKeyFromRequest(req)).toBe("mykey");
  });

  it("reads admin_session cookie when no header", () => {
    const req = new Request("http://x/", {
      headers: { cookie: "other=foo; admin_session=cookiekey; another=bar" },
    });
    expect(adminKeyFromRequest(req)).toBe("cookiekey");
  });

  it("prefers Authorization header over cookie", () => {
    const req = new Request("http://x/", {
      headers: {
        authorization: "Bearer headerkey",
        cookie: "admin_session=cookiekey",
      },
    });
    expect(adminKeyFromRequest(req)).toBe("headerkey");
  });

  it("returns null when neither is present", () => {
    const req = new Request("http://x/");
    expect(adminKeyFromRequest(req)).toBeNull();
  });

  it("decodes URI-encoded cookie values", () => {
    const req = new Request("http://x/", {
      headers: { cookie: "admin_session=key%3Awith%3Acolons" },
    });
    expect(adminKeyFromRequest(req)).toBe("key:with:colons");
  });
});
