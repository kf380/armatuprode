import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminKeyFromRequest, isValidAdmin } from "@/lib/admin-auth";

/**
 * Read recent admin audit log entries. Admin-only.
 * Used by ops to review who did what (and from where).
 */
export async function GET(request: NextRequest) {
  const adminKey = adminKeyFromRequest(request);
  if (!isValidAdmin(adminKey)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);
  const action = searchParams.get("action");

  const entries = await prisma.adminAuditLog.findMany({
    where: action ? { action } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      action: e.action,
      adminHash: e.adminHash,
      ip: e.ip,
      userAgent: e.userAgent,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
