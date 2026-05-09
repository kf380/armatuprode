import { NextRequest, NextResponse } from "next/server";
import { expireOldLots } from "@/lib/wallet";
import { validateProductionEnv } from "@/lib/env";

export async function GET(request: NextRequest) {
  validateProductionEnv();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!cronSecret || !token || token !== cronSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await expireOldLots();

  return NextResponse.json(result);
}
