import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Health + warmup endpoint. Cheap query (SELECT 1) to keep the Lambda warm
 * for the rest of the API surface. Intended to be pinged every ~5 min by
 * cron-job.org so production users hit a warm function instead of cold-start.
 *
 * Public on purpose: no secrets, no PII; only confirms the route can reach DB.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
