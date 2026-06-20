import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { invalidateDashboardCache, invalidateGroupsCache, invalidateGroupDetailCache, invalidateGroupMembersCache } from "@/lib/dashboard-cache";
import { log } from "@/lib/log";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id: groupId } = await params;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No sos miembro de este grupo" }, { status: 404 });
  }

  // Admins can only leave if there is another admin or if the group has no other members.
  if (membership.role === "ADMIN") {
    const otherAdmins = await prisma.groupMember.count({
      where: { groupId, role: "ADMIN", userId: { not: dbUser.id } },
    });
    const totalMembers = await prisma.groupMember.count({ where: { groupId } });
    if (otherAdmins === 0 && totalMembers > 1) {
      return NextResponse.json(
        { error: "Sos el único admin. Nombrá otro admin antes de salir." },
        { status: 409 },
      );
    }
  }

  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });

  log("info", "group_left", { groupId, userId: dbUser.id });

  void Promise.all([
    invalidateDashboardCache(dbUser.id),
    invalidateGroupsCache(dbUser.id),
    invalidateGroupDetailCache(groupId),
    invalidateGroupMembersCache(groupId),
  ]);

  return NextResponse.json({ ok: true });
}
