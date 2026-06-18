import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { syncFootballData } from "@/lib/sync-football-data";
import { validateProductionEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  validateProductionEnv();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (
    !cronSecret ||
    !token ||
    token.length !== cronSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
  ) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const fdToken = process.env.FOOTBALL_DATA_TOKEN;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!fdToken || !adminKey) {
    return NextResponse.json(
      { error: "Faltan FOOTBALL_DATA_TOKEN o ADMIN_API_KEY" },
      { status: 500 },
    );
  }

  // Cheap guard: skip if there's nothing potentially syncable in the window.
  // Active = LIVE right now, OR kicked off within the last 4h (might be
  // finishing), OR kicks off within the next 30min (warm-up). When none of
  // those hold, the call is a no-op and we don't burn football-data quota.
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const in30min = new Date(now.getTime() + 30 * 60 * 1000);
  const activeCount = await prisma.match.count({
    where: {
      OR: [
        { status: "LIVE" },
        {
          status: { in: ["UPCOMING", "LIVE"] },
          matchDate: { gte: sixHoursAgo, lte: in30min },
        },
        { status: "UPCOMING", matchDate: { lte: now } },
      ],
    },
  });
  if (activeCount === 0) {
    return NextResponse.json({ ok: true, skipped: "no_active_matches" });
  }

  const baseUrl =
    process.env.ARMATUPRODE_BASE_URL ??
    `https://${request.headers.get("host") ?? "armatuprode.com.ar"}`;

  try {
    const summary = await syncFootballData({
      apply: true,
      baseUrl,
      adminKey,
      fdToken,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
