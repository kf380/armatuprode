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

    // Check if user already exists by authId or email
    let dbUser = await prisma.user.findFirst({
      where: { OR: [{ authId: user.id }, { email: user.email! }] },
    });

    if (dbUser) {
      // Update existing user (link to current auth if needed)
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: { authId: user.id, name, avatar, country, countryName },
      });
    } else {
      // Create new user
      const referralCode = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)
        + Math.random().toString(36).slice(2, 6);

      dbUser = await prisma.user.create({
        data: {
          authId: user.id,
          email: user.email!,
          name,
          avatar: avatar || "🎮",
          country: country || "🇦🇷",
          countryName: countryName || "Argentina",
          referralCode,
        },
      });
    }

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

    // Find by authId first, then fallback to email
    let dbUser = await prisma.user.findUnique({
      where: { authId: user.id },
    });

    if (!dbUser && user.email) {
      dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      // Link to current auth session
      if (dbUser) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { authId: user.id },
        });
      }
    }

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ user: dbUser });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Error interno", detail: String(err) }, { status: 500 });
  }
}
