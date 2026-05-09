import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { flags } from "@/lib/flags";
import { log } from "@/lib/log";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export async function GET(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ organizations: [] });
  }

  // Orgs the user owns OR is a member of.
  const owned = await prisma.organization.findMany({
    where: { ownerId: dbUser.id },
    orderBy: { createdAt: "desc" },
  });
  const memberRows = await prisma.organizationMember.findMany({
    where: { userId: dbUser.id },
    include: { organization: true },
  });
  const ownedIds = new Set(owned.map((o) => o.id));
  const memberOrgs = memberRows
    .map((m) => m.organization)
    .filter((o) => !ownedIds.has(o.id));

  return NextResponse.json({
    organizations: [...owned, ...memberOrgs].map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      logoUrl: o.logoUrl,
      description: o.description,
      plan: o.plan,
      isOwner: o.ownerId === dbUser.id,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { user } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!flags.enableB2bOrganizers()) {
    return NextResponse.json({ error: "B2B no disponible" }, { status: 403 });
  }
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const { slug, name, logoUrl, description } = body as {
    slug?: string;
    name?: string;
    logoUrl?: string;
    description?: string;
  };

  if (!name || name.trim().length < 2) {
    return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
  }
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "Slug inválido. Usá minúsculas, números y guiones (3-40 chars)." },
      { status: 400 },
    );
  }
  if (logoUrl && !/^https:\/\//.test(logoUrl)) {
    return NextResponse.json({ error: "logoUrl debe ser HTTPS" }, { status: 400 });
  }

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Ese slug ya está en uso" }, { status: 409 });
  }

  const org = await prisma.organization.create({
    data: {
      slug,
      name: name.trim(),
      logoUrl: logoUrl ?? null,
      description: description ?? null,
      ownerId: dbUser.id,
      members: {
        create: { userId: dbUser.id, role: "OWNER" },
      },
    },
  });

  log("info", "organization_created", { orgId: org.id, slug: org.slug, ownerId: dbUser.id });

  return NextResponse.json({ organization: org }, { status: 201 });
}
