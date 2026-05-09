import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";

async function resolveOrgRole(orgId: string, userId: string): Promise<"OWNER" | "ADMIN" | "PLAYER" | null> {
  const m = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  return m?.role ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { members: true, groups: true } } },
  });
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  const role = await resolveOrgRole(id, dbUser.id);
  const isOwner = org.ownerId === dbUser.id;
  if (!isOwner && !role) {
    return NextResponse.json({ error: "No tenés acceso a esta organización" }, { status: 403 });
  }

  return NextResponse.json({
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      logoUrl: org.logoUrl,
      description: org.description,
      plan: org.plan,
      billingStatus: org.billingStatus,
      maxPlayers: org.maxPlayers,
      memberCount: org._count.members,
      groupCount: org._count.groups,
      isOwner,
      role: role ?? (isOwner ? "OWNER" : null),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });

  const role = await resolveOrgRole(id, dbUser.id);
  const isOwner = org.ownerId === dbUser.id;
  if (!isOwner && role !== "ADMIN") {
    return NextResponse.json({ error: "Solo OWNER/ADMIN puede editar la organización" }, { status: 403 });
  }

  const body = await request.json();
  const { name, logoUrl, description } = body as {
    name?: string;
    logoUrl?: string | null;
    description?: string | null;
  };
  if (logoUrl && !/^https:\/\//.test(logoUrl)) {
    return NextResponse.json({ error: "logoUrl debe ser HTTPS" }, { status: 400 });
  }

  const updated = await prisma.organization.update({
    where: { id },
    data: {
      name: name?.trim() ?? undefined,
      logoUrl: logoUrl === null ? null : logoUrl ?? undefined,
      description: description === null ? null : description ?? undefined,
    },
  });

  return NextResponse.json({ organization: updated });
}
