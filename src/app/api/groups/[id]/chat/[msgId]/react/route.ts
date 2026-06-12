import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

const ALLOWED_EMOJIS = new Set(["⚽", "🔥", "😂", "🐔", "💪", "👏"]);

async function authorizeMember(request: NextRequest, groupId: string, msgId: string) {
  const { user } = await getAuthUser(request);
  if (!user) return { error: "No autorizado", status: 401 as const };
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return { error: "Usuario no encontrado", status: 404 as const };
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });
  if (!member) return { error: "No sos miembro de este grupo", status: 403 as const };
  const message = await prisma.chatMessage.findUnique({ where: { id: msgId } });
  if (!message || message.groupId !== groupId) {
    return { error: "Mensaje no encontrado", status: 404 as const };
  }
  return { dbUser, message };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { id: groupId, msgId } = await params;
  const auth = await authorizeMember(request, groupId, msgId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json({ error: "Emoji no permitido" }, { status: 400 });
  }

  await prisma.chatReaction.upsert({
    where: { messageId_userId_emoji: { messageId: msgId, userId: auth.dbUser.id, emoji } },
    create: { messageId: msgId, userId: auth.dbUser.id, emoji },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> },
) {
  const { id: groupId, msgId } = await params;
  const auth = await authorizeMember(request, groupId, msgId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = new URL(request.url);
  const emoji = url.searchParams.get("emoji") ?? "";
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json({ error: "Emoji no permitido" }, { status: 400 });
  }

  await prisma.chatReaction.deleteMany({
    where: { messageId: msgId, userId: auth.dbUser.id, emoji },
  });

  return NextResponse.json({ ok: true });
}
