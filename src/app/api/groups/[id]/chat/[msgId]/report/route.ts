import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function POST(
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

  // Membership check
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No sos miembro del grupo" }, { status: 403 });
  }

  const message = await prisma.chatMessage.findUnique({ where: { id: msgId } });
  if (!message || message.groupId !== groupId) {
    return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });
  }

  // Reuse ActivityEvent table for reports
  await prisma.activityEvent.create({
    data: {
      groupId,
      userId: dbUser.id,
      type: "chat_report",
      text: `reporto mensaje ${msgId}`,
      icon: "🚩",
    },
  });

  return NextResponse.json({ ok: true });
}
