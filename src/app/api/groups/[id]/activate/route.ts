import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/supabase-server";
import { log } from "@/lib/log";
import { resolveLimits } from "@/lib/plans";

/**
 * Activate a FREE group. For premium plans, the activation happens via the
 * MercadoPago webhook (POST /api/payments/create with type=group_activation
 * → MP redirect → webhook approves → group flips to ACTIVE).
 *
 * This endpoint is the FREE-only escape hatch for groups that were created
 * in DRAFT status but are now ready to go ACTIVE without payment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user } = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const { id } = await params;
  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 });

  if (group.createdById !== dbUser.id) {
    return NextResponse.json({ error: "Solo el creador puede activar este prode" }, { status: 403 });
  }

  if (group.status === "ACTIVE") {
    return NextResponse.json({ error: "El prode ya está activo" }, { status: 400 });
  }

  if (group.planType !== "FREE") {
    return NextResponse.json(
      {
        error: "Este prode requiere pago. Usá /api/payments/create con type=group_activation.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.group.update({
    where: { id },
    data: {
      status: "ACTIVE",
      participantLimit: resolveLimits("FREE").maxPlayers,
    },
  });

  log("info", "group_activated_free", { groupId: id, ownerId: dbUser.id });
  return NextResponse.json({ group: updated });
}
