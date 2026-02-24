import { NextRequest, NextResponse } from "next/server";
import { expireOldLots } from "@/lib/wallet";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_API_KEY;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await expireOldLots();

  return NextResponse.json(result);
}
