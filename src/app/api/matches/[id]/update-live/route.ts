import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: accept admin key in Authorization header or body (backwards compat)
  const authHeader = request.headers.get("authorization");
  const body = await request.json();
  const adminKey = authHeader?.replace("Bearer ", "") || body.adminKey;
  const { scoreA, scoreB, minute, period } = body;

  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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

  return NextResponse.json({ ok: true, matchId: id });
}
