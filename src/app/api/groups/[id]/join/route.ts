import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { createActivityEvent } from "@/lib/notifications";

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

  const member = await prisma.groupMember.create({
    data: {
      userId: dbUser.id,
      groupId: id,
      role: "MEMBER",
    },
  });

  // Create activity event
  createActivityEvent({
    groupId: id,
    userId: dbUser.id,
    type: "join",
    text: "se unio al grupo",
    icon: "👋",
  }).catch(() => {});

  return NextResponse.json({ member }, { status: 201 });
}
