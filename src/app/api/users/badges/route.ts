import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { getUserBadgesWithProgress } from "@/lib/badges";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const tournament = await prisma.tournament.findFirst({ where: { active: true } });
  const tournamentId = tournament?.id || "";

  const badges = await getUserBadgesWithProgress(dbUser.id, tournamentId);

  return NextResponse.json({ badges });
}
