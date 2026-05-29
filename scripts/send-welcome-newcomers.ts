/**
 * Welcome MANUAL para usuarios que se registraron antes de que el auto-welcome existiera.
 * Solo para los 3 más nuevos (29-may) que NO recibieron feedback campaign.
 *
 *   npx tsx scripts/send-welcome-newcomers.ts            # dry-run
 *   npx tsx scripts/send-welcome-newcomers.ts --test     # solo a TEST_RECIPIENT
 *   npx tsx scripts/send-welcome-newcomers.ts --send     # live
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { Resend } from "resend";

const FROM = "Kevin <hola@armatuprode.com.ar>";
const TEST_RECIPIENT = "kevinfavre@gmail.com";
const SEND_INTERVAL_MS = 2000;

type Recipient = { name: string; email: string };

const RECIPIENTS: Recipient[] = [
  { name: "Nicolás", email: "nicoplunkett@gmail.com" },
  { name: "Fede", email: "fehorak@gmail.com" },
  { name: "Felipe", email: "fgimenezlosano@gmail.com" },
];

const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;

const subjectFor = (name: string) =>
  `${firstName(name)}, bienvenido a Armatuprode`;

const bodyFor = (name: string) => `Hola ${firstName(name)}, ¿cómo estás?

Soy Kevin, estoy detrás de Armatuprode.

Vi que entraste hace poco — gracias por sumarte. El Mundial arranca el 11 de junio (Mexico vs South Africa), así que tenés unos días para armar todo.

Mientras tanto podés:
• Crear un grupo y compartir el link con amigos para jugar juntos
• Unirte a uno con un código que te pasen
• Mirar el calendario completo de partidos

Si te trabás en algo o algo no se entiende, respondé este mail directo. Estoy puliendo cosas antes del primer partido y tu feedback me sirve.

Gracias,
Kevin`;

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

  const queue: Recipient[] = testOnly
    ? [{ name: "Kevin (test)", email: TEST_RECIPIENT }]
    : RECIPIENTS;

  console.log(`\nMode: ${dryRun ? "DRY-RUN" : testOnly ? "TEST" : "LIVE"}`);
  console.log(`Recipients: ${queue.length}\n`);

  for (const [i, r] of queue.entries()) {
    const subject = subjectFor(r.name);
    const text = bodyFor(r.name);

    if (dryRun) {
      console.log(`--- [${i + 1}/${queue.length}] ${r.email} ---`);
      console.log(`Subject: ${subject}\n${text}\n`);
      continue;
    }

    try {
      const result = await resend!.emails.send({ from: FROM, to: r.email, subject, text });
      if (result.error) {
        console.error(`[${i + 1}/${queue.length}] FAIL ${r.email}:`, result.error);
      } else {
        console.log(`[${i + 1}/${queue.length}] OK   ${r.email}  id=${result.data?.id}`);
      }
    } catch (e) {
      console.error(`[${i + 1}/${queue.length}] ERR  ${r.email}:`, e);
    }
    if (i < queue.length - 1) await new Promise((res) => setTimeout(res, SEND_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
