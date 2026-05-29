/**
 * Lista las tablas que existen REALMENTE en el schema public.
 *   npx tsx scripts/list-db-tables.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\\_%'
    ORDER BY tablename;
  `;

  console.log(`\nTablas en public schema: ${tables.length}\n`);
  for (const t of tables) {
    console.log(`  ${t.rowsecurity ? "🟢 RLS ON " : "🔴 RLS OFF"}  "${t.tablename}"`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
