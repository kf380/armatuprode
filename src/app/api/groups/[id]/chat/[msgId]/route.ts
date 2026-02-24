import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId, msgId } = await params;

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Only ADMIN can delete
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo admins pueden borrar mensajes" }, { status: 403 });
  }

  const message = await prisma.chatMessage.findUnique({ where: { id: msgId } });
  if (!message || message.groupId !== groupId) {
    return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }

  await prisma.chatMessage.update({
    where: { id: msgId },
    data: { deleted: true },
  });

  return NextResponse.json({ ok: true });
}
