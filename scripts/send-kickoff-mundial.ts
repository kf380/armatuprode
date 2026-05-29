/**
 * Kick-off mail pre-Mundial. Pensado para correr 9-jun (~48hs antes del primer partido).
 * Toma TODOS los users de la tabla User dinámicamente (excluye al sender).
 *
 *   npx tsx scripts/send-kickoff-mundial.ts             # dry-run (preview todos)
 *   npx tsx scripts/send-kickoff-mundial.ts --test      # solo a TEST_RECIPIENT
 *   npx tsx scripts/send-kickoff-mundial.ts --send      # live (manda a todos)
 *
 * Para targeting más fino, sumar flags --only-no-pick o --only-no-group.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { prettifyFirstName } from "../src/lib/welcome-email";

const FROM = "Kevin <hola@armatuprode.com.ar>";
const TEST_RECIPIENT = "kevinfavre@gmail.com";
const SEND_INTERVAL_MS = 2000;
const EXCLUDE_EMAILS = new Set([
  "kevinfavre@gmail.com", // sender
]);

const FIRST_MATCH = {
  date: "11 de junio",
  teamA: "Mexico",
  teamB: "South Africa",
  time: "19:00 hora argentina",
};

const firstNameOf = prettifyFirstName;

const subjectFor = (name: string) =>
  `${firstNameOf(name)}, faltan 48hs para el primer partido del Mundial`;

const bodyFor = (name: string) => `Hola ${firstNameOf(name)}, ¿cómo estás?

Soy Kevin de Armatuprode. Te escribo porque arranca el Mundial en 48hs:

  ${FIRST_MATCH.teamA} vs ${FIRST_MATCH.teamB} — ${FIRST_MATCH.date}, ${FIRST_MATCH.time}

Es el momento. Si todavía no armaste tu prode:

• Creá un grupo y pasale el link a tus amigos por WhatsApp
• O metete a uno con un código que te hayan pasado
• Cargá tus predicciones del primer partido antes del jueves

Entrá a https://armatuprode.com.ar y en 2 minutos quedás dentro.

Si algo no te funciona o tenés dudas, respondé este mail directo. Voy a estar atento mientras arranca todo.

Gracias por jugar,
Kevin`;

const prisma = new PrismaClient();

async function main() {
  const args = new Set(process.argv.slice(2));
  const live = args.has("--send");
  const testOnly = args.has("--test");
  const dryRun = !live && !testOnly;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey && !dryRun) {
    console.error("Falta RESEND_API_KEY en .env.local");
    process.exit(1);
  }
  const resend = apiKey ? new Resend(apiKey) : null;

  const users = await prisma.user.findMany({
    select: { email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const queue = testOnly
    ? [{ email: TEST_RECIPIENT, name: "Kevin (test)" }]
    : users.filter((u) => !EXCLUDE_EMAILS.has(u.email));

  console.log(`\nMode: ${dryRun ? "DRY-RUN" : testOnly ? "TEST" : "LIVE"}`);
  console.log(`Recipients: ${queue.length}\n`);
  if (dryRun && queue.length > 3) {
    console.log("(mostrando solo el primero como muestra — los demás usan el mismo template)\n");
  }

  for (const [i, u] of queue.entries()) {
    const subject = subjectFor(u.name);
    const text = bodyFor(u.name);

    if (dryRun) {
      if (i < 3) {
        console.log(`--- [${i + 1}/${queue.length}] ${u.email}  (${u.name}) ---`);
        console.log(`Subject: ${subject}\n${text}\n`);
      }
      continue;
    }

    try {
      const result = await resend!.emails.send({ from: FROM, to: u.email, subject, text });
      if (result.error) {
        console.error(`[${i + 1}/${queue.length}] FAIL ${u.email}:`, result.error);
      } else {
        console.log(`[${i + 1}/${queue.length}] OK   ${u.email}  id=${result.data?.id}`);
      }
    } catch (e) {
      console.error(`[${i + 1}/${queue.length}] ERR  ${u.email}:`, e);
    }
    if (i < queue.length - 1) await new Promise((res) => setTimeout(res, SEND_INTERVAL_MS));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
