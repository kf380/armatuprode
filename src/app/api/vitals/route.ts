import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/log";
import { rateLimit, getClientIp } from "@/lib/ratelimit";

/**
 * Receives Web Vitals samples from the client and logs them. Cheap: no DB
 * write — vitals are noisy. If we ever want aggregates, ship to PostHog or
 * Vercel Analytics from here.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit("vitals", getClientIp(request));
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    log("info", "web_vital", {
      name: body.name,
      value: typeof body.value === "number" ? body.value : null,
      rating: body.rating ?? null,
      id: body.id ?? null,
      url: body.url ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
