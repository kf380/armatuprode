import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { VALID_STICKER_KEYS } from "@/lib/stickers";

const PAGE_SIZE = 20;
const URL_REGEX = /https?:\/\/[^\s]+/i;
const MAX_CONTENT_LENGTH = 120;
const COOLDOWN_MS = 5000;
const RATE_WINDOW_MS = 30000;
const RATE_LIMIT = 5;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // Validate membership
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No sos miembro del grupo" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const after = searchParams.get("after");
  const before = searchParams.get("before");

  let messages;
  if (after) {
    // Forward poll: messages newer than cursor
    const cursor = await prisma.chatMessage.findUnique({ where: { id: after } });
    if (!cursor) {
      return NextResponse.json({ messages: [], nextCursor: null });
    }
    messages = await prisma.chatMessage.findMany({
      where: {
        groupId,
        createdAt: { gt: cursor.createdAt },
      },
      orderBy: { createdAt: "asc" },
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
  } else if (before) {
    // Backward: older messages
    const cursor = await prisma.chatMessage.findUnique({ where: { id: before } });
    if (!cursor) {
      return NextResponse.json({ messages: [], nextCursor: null });
    }
    messages = await prisma.chatMessage.findMany({
      where: {
        groupId,
        createdAt: { lt: cursor.createdAt },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    messages.reverse();
  } else {
    // Initial load: latest messages
    messages = await prisma.chatMessage.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      include: { user: { select: { id: true, name: true, avatar: true } } },
    });
    messages.reverse();
  }

  const nextCursor = messages.length === PAGE_SIZE ? messages[messages.length - 1].id : null;

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      type: m.type,
      content: m.deleted ? "" : m.content,
      stickerKey: m.deleted ? null : m.stickerKey,
      deleted: m.deleted,
      userId: m.userId,
      user: m.user ? { id: m.user.id, name: m.user.name, avatar: m.user.avatar } : null,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: groupId } = await params;

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  // 1. Membership check
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No sos miembro del grupo" }, { status: 403 });
  }

  // 2. Mute check
  const mute = await prisma.chatMute.findUnique({
    where: { groupId_userId: { groupId, userId: dbUser.id } },
  });
  if (mute && mute.mutedUntil > new Date()) {
    const mins = Math.ceil((mute.mutedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Estas muteado por ${mins} minuto${mins !== 1 ? "s" : ""} mas` },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { type, content, stickerKey } = body;

  // 3. Type validation
  if (!type || !["TEXT", "STICKER"].includes(type)) {
    return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
  }

  // 4. Content validation
  if (type === "TEXT") {
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: `Maximo ${MAX_CONTENT_LENGTH} caracteres` }, { status: 400 });
    }
    // 5. URL block
    if (URL_REGEX.test(content)) {
      return NextResponse.json({ error: "No se permiten links" }, { status: 400 });
    }
  }

  if (type === "STICKER") {
    if (!stickerKey || !VALID_STICKER_KEYS.has(stickerKey)) {
      return NextResponse.json({ error: "Sticker invalido" }, { status: 400 });
    }
  }

  // 6. Cooldown: last message < 5s ago
  const lastMessage = await prisma.chatMessage.findFirst({
    where: { groupId, userId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });
  if (lastMessage && Date.now() - lastMessage.createdAt.getTime() < COOLDOWN_MS) {
    return NextResponse.json({ error: "Espera unos segundos" }, { status: 429 });
  }

  // 7. Rate limit: max 5 messages in 30s
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const recentCount = await prisma.chatMessage.count({
    where: {
      groupId,
      userId: dbUser.id,
      createdAt: { gte: windowStart },
    },
  });
  if (recentCount >= RATE_LIMIT) {
    return NextResponse.json({ error: "Demasiados mensajes, espera un momento" }, { status: 429 });
  }

  // 8. Duplicate sticker check (same sticker in last 10s)
  if (type === "STICKER") {
    const dupCheck = await prisma.chatMessage.findFirst({
      where: {
        groupId,
        userId: dbUser.id,
        type: "STICKER",
        stickerKey,
        createdAt: { gte: new Date(Date.now() - 10000) },
      },
    });
    if (dupCheck) {
      return NextResponse.json({ error: "Ya enviaste este sticker" }, { status: 429 });
    }
  }

  // Find sticker emoji for content if sticker type
  let messageContent = content?.trim() || "";
  if (type === "STICKER") {
    const { STICKERS } = await import("@/lib/stickers");
    const sticker = STICKERS.find((s) => s.key === stickerKey);
    messageContent = sticker?.emoji || "";
  }

  const message = await prisma.chatMessage.create({
    data: {
      groupId,
      userId: dbUser.id,
      type,
      content: messageContent,
      stickerKey: type === "STICKER" ? stickerKey : null,
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  return NextResponse.json(
    {
      message: {
        id: message.id,
        type: message.type,
        content: message.content,
        stickerKey: message.stickerKey,
        deleted: false,
        userId: message.userId,
        user: message.user ? { id: message.user.id, name: message.user.name, avatar: message.user.avatar } : null,
        createdAt: message.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
