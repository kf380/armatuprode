import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, hashSecret } from "@/lib/ratelimit";
import { adminKeyFromRequest, isValidAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminKey = adminKeyFromRequest(request);
  if (!isValidAdmin(adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const adminRl = await rateLimit("adminByKey", hashSecret(adminKey!));
  if (!adminRl.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  const body = await request.json();
  const { scoreA, scoreB, minute, period } = body;

  const { id } = await params;

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  if (match.status === "FINISHED") {
    return NextResponse.json({ error: "Partido ya finalizado, no se puede volver a LIVE" }, { status: 409 });
  }

  // Update to LIVE status with current scores and optional minute/period
  await prisma.match.update({
    where: { id },
    data: {
      status: "LIVE",
      scoreA: scoreA ?? match.scoreA,
      scoreB: scoreB ?? match.scoreB,
      ...(minute != null ? { minute } : {}),
      ...(period ? { period } : {}),
    },
  });

  await logAdminAction(request, "update_live", adminKey, {
    matchId: id,
    scoreA: scoreA ?? null,
    scoreB: scoreB ?? null,
    minute: minute ?? null,
    period: period ?? null,
  });

  return NextResponse.json({ ok: true, matchId: id });
}
