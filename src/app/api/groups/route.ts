import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  });

  if (!dbUser) {
    return NextResponse.json({ groups: [] });
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId: dbUser.id },
    include: {
      group: {
        include: {
          tournament: { select: { name: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  const groups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    emoji: m.group.emoji,
    tournament: m.group.tournament.name,
    memberCount: m.group._count.members,
    role: m.role,
    hasPool: m.group.hasPool,
    entryFee: m.group.entryFee,
    currency: m.group.currency,
    inviteCode: m.group.inviteCode,
  }));

  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { name, emoji, tournamentId, hasPool, entryFee, currency } = body;

  if (!name || !tournamentId) {
    return NextResponse.json({ error: "Nombre y torneo son requeridos" }, { status: 400 });
  }

  const group = await prisma.group.create({
    data: {
      name,
      emoji: emoji || "🏆",
      tournamentId,
      createdById: dbUser.id,
      hasPool: hasPool || false,
      entryFee: entryFee || 0,
      currency: currency || "ARS",
      members: {
        create: {
          userId: dbUser.id,
          role: "ADMIN",
        },
      },
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
