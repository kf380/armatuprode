import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId: id } },
  });
  if (!membership) {
    return NextResponse.json({ error: "No sos miembro de este grupo" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  const events = await prisma.activityEvent.findMany({
    where: { groupId: id },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });

  const hasMore = events.length > limit;
  const items = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({
    events: items.map((e) => ({
      id: e.id,
      type: e.type,
      text: e.text,
      icon: e.icon,
      user: e.user.name,
      userId: e.user.id,
      avatar: e.user.avatar,
      time: e.createdAt.toISOString(),
    })),
    nextCursor,
  });
}
