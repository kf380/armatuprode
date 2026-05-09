import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";

/**
 * Server-side admin auth. Accepts either:
 *   - Authorization: Bearer <ADMIN_API_KEY>  (used by admin endpoints / scripts)
 *   - admin_session cookie set by /api/admin/auth POST
 *
 * The cookie is httpOnly + secure + sameSite=strict; its value is the raw
 * ADMIN_API_KEY, which is never readable from JS. Comparison is constant time.
 */
export function isValidAdmin(provided: string | null | undefined): boolean {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || !provided) return false;
  if (expected.length !== provided.length) return false;
  // Constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

export function adminKeyFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  // Cookie fallback (sent automatically by browser when credentials: include)
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    for (const part of cookieHeader.split(";")) {
      const [k, v] = part.trim().split("=");
      if (k === COOKIE_NAME && v) return decodeURIComponent(v);
    }
  }
  return null;
}

/**
 * Server Component helper — reads the cookie via Next.js cookies() and validates.
 */
export async function isAdminFromCookie(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value ?? null;
  return isValidAdmin(value);
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
