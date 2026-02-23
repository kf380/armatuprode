import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const body = await request.json();
  const { adminKey, scoreA, scoreB } = body;

  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }

  // Update to LIVE status with current scores
  await prisma.match.update({
    where: { id },
    data: {
      status: "LIVE",
      scoreA: scoreA ?? match.scoreA,
      scoreB: scoreB ?? match.scoreB,
    },
  });

  return NextResponse.json({ ok: true, matchId: id });
}
