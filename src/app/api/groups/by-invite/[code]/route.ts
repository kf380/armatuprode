import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint (no auth required) — returns basic group info by invite code
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code) {
    return NextResponse.json({ error: "Codigo requerido" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: {
      tournament: { select: { name: true } },
      _count: { select: { members: true } },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  // Get creator name
  const creator = await prisma.groupMember.findFirst({
    where: { groupId: group.id, role: "ADMIN" },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      tournament: group.tournament.name,
      members: group._count.members,
      hasPool: group.hasPool,
      poolAmount: group.hasPool ? group._count.members * group.entryFee : 0,
      entryFee: group.entryFee,
      currency: group.currency,
      inviteCode: group.inviteCode,
      createdBy: creator?.user.name || "Admin",
    },
  });
}
