import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tournaments = await prisma.tournament.findMany({
    where: { active: true },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { matches: true } },
    },
  });

  return NextResponse.json({
    tournaments: tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      phase: t.phase,
      startDate: t.startDate.toISOString(),
      endDate: t.endDate.toISOString(),
      matchCount: t._count.matches,
    })),
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const body = await request.json();
  const adminKey = authHeader?.replace("Bearer ", "") || body.adminKey;

  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { name, type, startDate, endDate } = body;

  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: "Faltan campos requeridos (name, startDate, endDate)" }, { status: 400 });
  }

  const tournament = await prisma.tournament.create({
    data: {
      name,
      type: type || "WORLD_CUP",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      active: true,
    },
  });

  return NextResponse.json({ tournament }, { status: 201 });
}
