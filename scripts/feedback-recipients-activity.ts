/**
 * Reporta actividad real de los users a los que mandamos el feedback email.
 * Para cada uno: cuándo se registró, si creó grupos, si se unió a alguno,
 * si hizo predicciones, y eventos de actividad.
 *
 *   npx tsx scripts/feedback-recipients-activity.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const EMAILS = [
  "alittass@gmail.com",
  "cpalaciosconnection@gmail.com",
  "ederluduena@gmail.com",
  "emeandres1091@gmail.com",
  "enzo.vazquez.388@gmail.com",
  "fabriziocellitti11@gmail.com",
  "jorgegarciapernice@gmail.com",
  "lucio.bermudez111@gmail.com",
  "mariano.arroyofonzalida@gmail.com",
  "marinagaun@gmail.com",
  "matipolicastro@gmail.com",
  "mercepereyras@gmail.com",
  "sofitenenbaum1@gmail.com",
];

const prisma = new PrismaClient();

async function main() {
  const rows: Array<{
    email: string;
    name: string;
    registered: string;
    created: number;
    joined: number;
    preds: number;
    events: number;
    coins: number;
    xp: number;
    detail: string;
  }> = [];

  for (const email of EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { group: { select: { name: true, createdById: true } } } },
      },
    });

    if (!user) {
      console.log(`\n${email}  ⚠️  NO existe en tabla User (solo en Supabase Auth)\n`);
      continue;
    }

    const [groupsCreated, predictionsCount, activityCount] = await Promise.all([
      prisma.group.count({ where: { createdById: user.id } }),
      prisma.prediction.count({ where: { userId: user.id } }),
      prisma.activityEvent.count({ where: { userId: user.id } }),
    ]);

    const detail = user.memberships
      .map((m) => `    · ${m.group.name} (${m.role}${m.group.createdById === user.id ? ", creador" : ""})`)
      .join("\n");

    rows.push({
      email,
      name: user.name,
      registered: user.createdAt.toISOString().slice(0, 10),
      created: groupsCreated,
      joined: user.memberships.length,
      preds: predictionsCount,
      events: activityCount,
      coins: user.coins,
      xp: user.xp,
      detail,
    });
  }

  // Ordenar por engagement: más grupos creados primero, después predicciones
  rows.sort((a, b) => b.created - a.created || b.preds - a.preds || b.events - a.events);

  console.log("\n=== Actividad de los users del feedback campaign ===\n");
  for (const r of rows) {
    console.log(
      `${r.email}  ${r.name}\n` +
        `  registro:  ${r.registered}    coins: ${r.coins}    xp: ${r.xp}\n` +
        `  grupos:    ${r.created} creado(s), ${r.joined} unido(s)\n` +
        `  picks:     ${r.preds} predicciones\n` +
        `  actividad: ${r.events} eventos\n` +
        (r.detail ? `${r.detail}\n` : ""),
    );
  }

  // Resumen
  const playedSomething = rows.filter((r) => r.preds > 0 || r.created > 0 || r.joined > 0);
  const zeroActivity = rows.filter((r) => r.preds === 0 && r.created === 0 && r.joined === 0);
  console.log(`\n=== Resumen ===`);
  console.log(`Total: ${rows.length}`);
  console.log(`Con alguna actividad (grupo o pick): ${playedSomething.length}`);
  console.log(`Zero activity (solo registro): ${zeroActivity.length}`);
  if (zeroActivity.length) {
    console.log(`  → ${zeroActivity.map((r) => r.email).join(", ")}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
