import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { name, avatar, country, countryName } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Nombre invalido" }, { status: 400 });
    }

    // Generate a short referral code
    const referralCode = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)
      + Math.random().toString(36).slice(2, 6);

    const dbUser = await prisma.user.upsert({
      where: { authId: user.id },
      update: { name, avatar, country, countryName },
      create: {
        authId: user.id,
        email: user.email!,
        name,
        avatar: avatar || "🎮",
        country: country || "🇦🇷",
        countryName: countryName || "Argentina",
        referralCode,
      },
    });

    return NextResponse.json({ user: dbUser }, { status: 201 });
  } catch (err) {
    console.error("POST /api/users error:", err);
    return NextResponse.json({ error: "Error interno", detail: String(err) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({ user: dbUser });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Error interno", detail: String(err) }, { status: 500 });
  }
}
