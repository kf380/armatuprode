import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminKeyFromRequest, isValidAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-audit";
import { log } from "@/lib/log";

/**
 * Manually release a stale scoring lock so /finish can be re-run.
 * Use only when /finish crashed mid-scoring and left the match in an
 * inconsistent state (FINISHED with scoringLockedAt set is normal — only
 * release if status != FINISHED but scoringLockedAt blocks retry).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminKey = adminKeyFromRequest(request);
  if (!isValidAdmin(adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return NextResponse.json({ error: "Partido no encontrado" }, { status: 404 });
  }
  if (match.status === "FINISHED") {
    return NextResponse.json(
      { error: "Partido ya finalizado, no se puede liberar lock" },
      { status: 409 },
    );
  }

  await prisma.match.update({
    where: { id },
    data: { scoringLockedAt: null },
  });
  log("warn", "match_scoring_lock_released", { matchId: id });
  await logAdminAction(request, "release_scoring_lock", adminKey, { matchId: id });

  return NextResponse.json({ ok: true });
}
