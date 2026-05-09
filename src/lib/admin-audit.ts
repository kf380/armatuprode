import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

/**
 * Record an admin action in AdminAuditLog. Best-effort: failures are logged but
 * don't break the request.
 *
 * `adminKey` is hashed (sha256, 16 hex chars) — we never store the raw secret.
 * `payload` should be a small object (no full bodies, no PII beyond identifiers).
 */
export async function logAdminAction(
  request: Request,
  action: string,
  adminKey: string | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const adminHash = adminKey
    ? crypto.createHash("sha256").update(adminKey).digest("hex").slice(0, 16)
    : null;
  const xff = request.headers.get("x-forwarded-for");
  const ip = xff ? xff.split(",")[0].trim() : (request.headers.get("x-real-ip") || null);
  const userAgent = request.headers.get("user-agent") || null;
  try {
    await prisma.adminAuditLog.create({
      data: { action, adminHash, ip, userAgent, payload: payload as object },
    });
  } catch (err) {
    log("error", "admin_audit_write_failed", { action, err: String(err) });
  }
  // Mirror to structured log for ops dashboards
  log("info", "admin_action", { action, adminHash, ip, ...payload });
}
