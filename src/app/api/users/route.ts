import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { creditCoins } from "@/lib/wallet";
import { WalletLotSource } from "@prisma/client";
import { log } from "@/lib/log";
import { rateLimit } from "@/lib/ratelimit";
import { limits } from "@/lib/limits";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import { trackServer } from "@/lib/analytics-server";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const rl = await rateLimit("usersWrite", user.id);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Demasiados intentos, esperá un momento" },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { name, avatar, country, countryName } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Nombre invalido" }, { status: 400 });
    }

    // 1. Try to find by current authId (this user already has a record).
    let dbUser = await prisma.user.findUnique({ where: { authId: user.id } });

    if (dbUser) {
      // Same auth identity: safe to update profile fields.
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: { name, avatar, country, countryName },
      });
      return NextResponse.json({ user: dbUser }, { status: 200 });
    }

    // 2. No record for this authId. Check if email is already taken by ANOTHER auth identity.
    if (user.email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
      if (existingByEmail) {
        // Different authId on the same email = takeover attempt or pre-existing unverified account.
        // Refuse to relink. Surface a generic message to avoid leaking account existence.
        log("warn", "user_signup_email_collision", {
          authId: user.id,
          email: user.email,
          existingUserId: existingByEmail.id,
        });
        return NextResponse.json(
          { error: "Ese email ya esta en uso. Iniciá sesión con la cuenta original o usá otro email." },
          { status: 409 },
        );
      }
    }

    // 3. Public-launch cap on total registered users.
    const userCount = await prisma.user.count();
    if (userCount >= limits.maxPublicUsers()) {
      return NextResponse.json(
        {
          error: "Tenemos un problema técnico para crear tu cuenta. Escribinos y te ayudamos enseguida.",
          contactEmail: "hola@armatuprode.com.ar",
          contactWhatsapp: "https://wa.me/?text=Hola%20Armatuprode%2C%20no%20puedo%20crear%20mi%20cuenta",
        },
        { status: 403 },
      );
    }

    // Create new user.
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

    // Welcome bonus only if email verified — blocks farming with fake emails in prod.
    // The Supabase user object exposes `email_confirmed_at` (ISO string) once
    // confirmation completed. In dev we credit anyway so the local flow works.
    const emailConfirmed = !!(user as { email_confirmed_at?: string | null }).email_confirmed_at;
    const isProd = process.env.NODE_ENV === "production";
    if (emailConfirmed || !isProd) {
      try {
        await creditCoins({
          userId: dbUser.id,
          amount: 100,
          source: WalletLotSource.ADMIN,
          reason: "welcome_bonus",
          idempotencyKey: `welcome_${dbUser.id}`,
        });
      } catch (err) {
        log("error", "welcome_bonus_failed", { userId: dbUser.id, err: String(err) });
      }
    } else {
      log("info", "welcome_bonus_deferred_email_unverified", { userId: dbUser.id });
    }

    // Welcome email — fire after creating row. Helper traga errores; no rompe signup.
    if (emailConfirmed || !isProd) {
      await sendWelcomeEmail({ email: dbUser.email, name: dbUser.name });
    }

    void trackServer(dbUser.id, "signup_completed", {
      email_verified: emailConfirmed,
      country: dbUser.country,
    });
    return NextResponse.json({ user: dbUser }, { status: 201 });
  } catch (err) {
    log("error", "users_post_failed", { err: String(err) });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuthUser(request);

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Find STRICTLY by authId. Do NOT fall back to email: that allowed
    // a new auth identity to take over an existing account by signing up
    // with the same (unverified) email.
    let dbUser = await prisma.user.findUnique({
      where: { authId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Welcome bonus claim: if user has now confirmed their email, ensure the
    // welcome bonus is credited. `idempotencyKey: welcome_<userId>` makes this
    // safe to call on every GET — already-credited users hit the idempotency
    // short-circuit and nothing changes.
    const emailConfirmed = !!(user as { email_confirmed_at?: string | null }).email_confirmed_at;
    if (emailConfirmed) {
      try {
        await creditCoins({
          userId: dbUser.id,
          amount: 100,
          source: WalletLotSource.ADMIN,
          reason: "welcome_bonus",
          idempotencyKey: `welcome_${dbUser.id}`,
        });
      } catch (err) {
        log("error", "welcome_bonus_claim_failed", { userId: dbUser.id, err: String(err) });
      }
    }

    // Backfill referral code for users created before the feature existed
    if (!dbUser.referralCode) {
      const referralCode = dbUser.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)
        + Math.random().toString(36).slice(2, 6);
      try {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { referralCode },
        });
      } catch {
        // Unique conflict — retry with different random suffix
        const retryCode = dbUser.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6)
          + Math.random().toString(36).slice(2, 6);
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { referralCode: retryCode },
        });
      }
    }

    return NextResponse.json({ user: dbUser });
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
