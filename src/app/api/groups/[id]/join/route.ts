import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { createActivityEvent } from "@/lib/notifications";
import { logSettled } from "@/lib/log";
import { canJoinGroup } from "@/lib/group-policy";
import { trackServer } from "@/lib/analytics-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json();
  const { inviteCode } = body;

  const group = await prisma.group.findUnique({
    where: { id },
  });

  if (!group) {
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });
  }

  if (group.inviteCode !== inviteCode) {
    return NextResponse.json({ error: "Codigo de invitacion invalido" }, { status: 403 });
  }

  const existing = await prisma.groupMember.findUnique({
    where: {
      userId_groupId: {
        userId: dbUser.id,
        groupId: id,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Ya sos miembro de este grupo" }, { status: 409 });
  }

  // Status + capacity policy check (centralized in lib/group-policy).
  const memberCount = await prisma.groupMember.count({ where: { groupId: id } });
  const policy = canJoinGroup(group, memberCount);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.reason }, { status: policy.status });
  }

  const member = await prisma.groupMember.create({
    data: {
      userId: dbUser.id,
      groupId: id,
      role: "MEMBER",
    },
  });

  // Create activity event — awaited so we don't lose it in serverless promise truncation.
  await logSettled(
    "group_join_activity_failed",
    { groupId: id, userId: dbUser.id },
    [
      createActivityEvent({
        groupId: id,
        userId: dbUser.id,
        type: "join",
        text: "se unio al grupo",
        icon: "👋",
      }),
    ],
  );

  void trackServer(dbUser.id, "group_join", { group_id: id, via: "invite_code" });
  return NextResponse.json({ member }, { status: 201 });
}
