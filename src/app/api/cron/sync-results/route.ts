import { NextRequest, NextResponse } from "next/server";
import { syncFootballData } from "@/lib/sync-football-data";
import { validateProductionEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  validateProductionEnv();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!cronSecret || !token || token !== cronSecret) {
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
