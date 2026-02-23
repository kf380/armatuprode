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
    include: { _count: { select: { referrals: true } } },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    referralCode: dbUser.referralCode,
    referralCount: dbUser._count.referrals,
  });
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (dbUser.referredById) {
    return NextResponse.json({ error: "Ya usaste un codigo de referido" }, { status: 409 });
  }

  const body = await request.json();
  const { code } = body;

  if (!code) {
    return NextResponse.json({ error: "Codigo requerido" }, { status: 400 });
  }

  const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
  if (!referrer) {
    return NextResponse.json({ error: "Codigo invalido" }, { status: 404 });
  }

  if (referrer.id === dbUser.id) {
    return NextResponse.json({ error: "No podes referirte a vos mismo" }, { status: 400 });
  }

  // Apply referral
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { referredById: referrer.id },
  });

  // XP for referrer
  await prisma.xpEvent.create({
    data: { userId: referrer.id, amount: 30, reason: "referral" },
  });
  await prisma.user.update({
    where: { id: referrer.id },
    data: { xp: { increment: 30 } },
  });

  // XP for referred user
  await prisma.xpEvent.create({
    data: { userId: dbUser.id, amount: 10, reason: "referred" },
  });
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { xp: { increment: 10 } },
  });

  return NextResponse.json({ ok: true });
}
