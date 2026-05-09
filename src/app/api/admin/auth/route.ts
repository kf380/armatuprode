import { NextRequest, NextResponse } from "next/server";
import { isValidAdmin, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { log } from "@/lib/log";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 8; // 8h

export async function POST(request: NextRequest) {
  // Rate limit by IP to prevent brute force
  const ip = getClientIp(request);
  const rl = await rateLimit("usersWrite", `admin-auth:${ip}`);
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const { key } = body as { key?: string };

  if (!isValidAdmin(key ?? null)) {
    log("warn", "admin_auth_failed", { ip });
    return NextResponse.json({ error: "Credenciales invalidas" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: key!,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
