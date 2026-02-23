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
