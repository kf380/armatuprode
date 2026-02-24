import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

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

  // Only ADMIN can mute
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: dbUser.id, groupId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo admins pueden mutear" }, { status: 403 });
  }

  const body = await request.json();
  const { targetUserId, durationMinutes } = body;

  if (!targetUserId || typeof targetUserId !== "string") {
    return NextResponse.json({ error: "targetUserId requerido" }, { status: 400 });
  }

  const duration = Math.min(Math.max(durationMinutes || 30, 1), 1440); // 1 min to 24h
  const mutedUntil = new Date(Date.now() + duration * 60000);

  // Verify target is a member
  const targetMembership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetUserId, groupId } },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Usuario no es miembro del grupo" }, { status: 404 });
  }

  // Can't mute another admin
  if (targetMembership.role === "ADMIN") {
    return NextResponse.json({ error: "No se puede mutear a un admin" }, { status: 403 });
  }

  await prisma.chatMute.upsert({
    where: { groupId_userId: { groupId, userId: targetUserId } },
    update: { mutedUntil },
    create: { groupId, userId: targetUserId, mutedUntil },
  });

  return NextResponse.json({ ok: true, mutedUntil: mutedUntil.toISOString() });
}
