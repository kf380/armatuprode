import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const { endpoint, p256dh, auth } = body;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Datos de suscripcion incompletos" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: dbUser.id, p256dh, auth },
    create: { userId: dbUser.id, endpoint, p256dh, auth },
  });

  return NextResponse.json({ ok: true });
}
