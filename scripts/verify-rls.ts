/**
 * Verifica que (a) Prisma sigue accediendo a la DB y (b) la anon key NO puede leer datos.
 *
 *   npx tsx scripts/verify-rls.ts
 *
 * Corré ANTES del apply (esperás "LEAKING" en todas) y DESPUÉS (esperás "BLOCKED" en todas).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Sample representativo, no las 27 — basta para confirmar el comportamiento
const TABLES = [
  "User",
  "Tournament",
  "Match",
  "Group",
  "Prediction",
  "Notification",
  "Wallet",
  "PaymentOrder",
  "Team",
];

type AnonResult = { status: number; rows?: number; bodyPreview?: string };

async function checkAnon(table: string): Promise<AnonResult> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=3`;
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  const text = await res.text();
  if (!res.ok) return { status: res.status, bodyPreview: text.slice(0, 100) };
  try {
    const data = JSON.parse(text);
    return { status: res.status, rows: Array.isArray(data) ? data.length : -1 };
  } catch {
    return { status: res.status, bodyPreview: text.slice(0, 100) };
  }
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
    process.exit(1);
  }

  console.log("=== Test 1: Prisma (via DATABASE_URL como superuser) ===");
  const [users, matches, tournaments, payments] = await Promise.all([
    prisma.user.count(),
    prisma.match.count(),
    prisma.tournament.count(),
    prisma.paymentOrder.count(),
  ]);
  console.log(`  User: ${users}    Match: ${matches}    Tournament: ${tournaments}    PaymentOrder: ${payments}`);
  if (users === 0) {
    console.error("\n⚠️  Prisma devuelve 0 users — algo raro con la connection. Abortar diagnóstico.");
    process.exit(1);
  }
  console.log("  ✓ Prisma sigue leyendo (bypasses RLS como esperado)\n");

  console.log("=== Test 2: Anon key (la que está en el bundle JS público) ===");
  console.log("  Esperado ANTES del apply: rows > 0 (datos expuestos)");
  console.log("  Esperado DESPUÉS del apply: rows = 0 (RLS bloqueando)\n");

  let leaking = 0;
  let blocked = 0;
  for (const table of TABLES) {
    const r = await checkAnon(table);
    const isBlocked = r.status === 200 && r.rows === 0;
    const isLeaking = r.status === 200 && (r.rows ?? 0) > 0;
    const icon = isBlocked ? "🟢" : isLeaking ? "🔴" : "⚠️ ";
    const verdict = isBlocked ? "BLOCKED" : isLeaking ? "LEAKING" : `status=${r.status}`;
    const detail = r.rows !== undefined ? `(rows visibles: ${r.rows})` : `(body: ${r.bodyPreview})`;
    console.log(`  ${icon} ${table.padEnd(16)} ${verdict.padEnd(8)} ${detail}`);
    if (isBlocked) blocked++;
    if (isLeaking) leaking++;
  }

  console.log("");
  if (leaking > 0) {
    console.log(`⚠️  ${leaking}/${TABLES.length} tablas todavía leakean datos al anon key.`);
    console.log("   Aplicar scripts/enable-rls.sql desde Supabase SQL Editor y volver a correr este verify.");
    process.exit(1);
  }
  console.log(`✓ ${blocked}/${TABLES.length} tablas bloqueadas a anon key. RLS funcionando.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
