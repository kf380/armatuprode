import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  const isOwner = org.ownerId === dbUser.id;
  if (!isOwner) {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId: dbUser.id } },
    });
    if (!member || member.role === "PLAYER") {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
  }

  const groups = await prisma.group.findMany({
    where: { organizationId: id },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      status: g.status,
      planType: g.planType,
      memberCount: g._count.members,
      inviteCode: g.inviteCode,
      createdAt: g.createdAt.toISOString(),
    })),
  });
}
