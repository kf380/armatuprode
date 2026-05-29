/**
 * Feedback campaign para users registrados de Armatuprode.
 *
 *   npx tsx scripts/send-feedback-emails.ts            # dry-run (default, no manda nada)
 *   npx tsx scripts/send-feedback-emails.ts --test     # manda solo a TEST_RECIPIENT
 *   npx tsx scripts/send-feedback-emails.ts --send     # manda a toda la lista
 *
 * Requiere RESEND_API_KEY en .env.local
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { Resend } from "resend";

const FROM = "Kevin <hola@armatuprode.com.ar>";
const TEST_RECIPIENT = "kevinfavre@gmail.com";
const SEND_INTERVAL_MS = 2000;

type Recipient = { name: string; email: string; skip?: string };

const RECIPIENTS: Recipient[] = [
  { name: "Alejandra Sanchez", email: "alittass@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Candela", email: "bussify.rrhh@gmail.com" },
  { name: "Candelaria Palacios", email: "cpalaciosconnection@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Eder Ludueña", email: "ederluduena@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Mauricio Ortiz", email: "emeandres1091@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Enzo Vazquez", email: "enzo.vazquez.388@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Fabrizio Cellitti", email: "fabriziocellitti11@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Jorge García Pernice", email: "jorgegarciapernice@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Lucio Bermudez", email: "lucio.bermudez111@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Mariano Arroyo", email: "mariano.arroyofonzalida@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Marina", email: "marinagaun@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Matías Policastro", email: "matipolicastro@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Mercedes Pereyra", email: "mercepereyras@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Sofia Tenenbaum", email: "sofitenenbaum1@gmail.com", skip: "enviado 2026-05-27" },
  { name: "Nahuel González", email: "nahugonzalez11@gmail.com" },
  { name: "Vicente Botta", email: "vicentebotta@gmail.com" },
];

const firstName = (full: string) => full.split(/\s+/)[0];

const subjectFor = (name: string) =>
  `${firstName(name)}, te quería pedir una mano con Armatuprode`;

const bodyFor = (name: string) => `Hola ${firstName(name)}, ¿cómo estás?

Soy Kevin, estoy detrás de Armatuprode.

Vi que te registraste en la plataforma y quería pedirte una mano rápida. Estoy ajustando algunas cosas de la app y me serviría mucho entender cómo la vio alguien que entró de afuera, sin demasiado contexto.

¿Te acordás si llegaste a probarla?

Y si no avanzaste mucho, también me sirve saber qué te frenó. Capaz no se entendió bien la idea, capaz crear un grupo no era tan claro, capaz la pantalla inicial no ayudó, o simplemente no era el momento.

Cualquier comentario, aunque sea de una línea, me ayuda mucho.

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
    : RECIPIENTS.filter((r) => !r.skip);

  const skipped = RECIPIENTS.filter((r) => r.skip);
  if (skipped.length && !testOnly) {
    console.log("\nSkipped (revisar a mano):");
    for (const s of skipped) console.log(`  - ${s.email} (${s.skip})`);
  }

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
