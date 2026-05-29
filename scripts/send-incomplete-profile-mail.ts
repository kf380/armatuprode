/**
 * Mail a usuarios que firmaron Auth (Google OAuth) pero NO completaron el SetupScreen.
 * Quedan invisibles en la app porque no tienen row en User table.
 *
 *   npx tsx scripts/send-incomplete-profile-mail.ts            # dry-run
 *   npx tsx scripts/send-incomplete-profile-mail.ts --test     # solo a TEST_RECIPIENT
 *   npx tsx scripts/send-incomplete-profile-mail.ts --send     # live
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { Resend } from "resend";

const FROM = "Kevin <hola@armatuprode.com.ar>";
const TEST_RECIPIENT = "kevinfavre@gmail.com";
const SEND_INTERVAL_MS = 2000;

type Recipient = { name: string; email: string; firstName?: string };

const RECIPIENTS: Recipient[] = [
  { name: "Enzo Vázquez", email: "enzo.vazquez.388@gmail.com" },
  { name: "Mercedes Pereyra", email: "mercepereyras@gmail.com" },
  { name: "Maria Florencia Demichelis", email: "demichelismf@gmail.com", firstName: "Florencia" },
];

const firstName = (r: Recipient) => r.firstName ?? r.name.split(/\s+/)[0];

const subjectFor = (r: Recipient) =>
  `${firstName(r)}, te quedaste a un paso de Armatuprode`;

const bodyFor = (r: Recipient) => `Hola ${firstName(r)}, ¿cómo estás?

Soy Kevin, estoy detrás de Armatuprode.

Vi que entraste con Google hace unos días pero no llegaste a terminar el setup del perfil (un form corto de nombre + avatar + país). Por eso no pudiste pasar a la sección de prodes.

Si querés terminar, entrá a https://armatuprode.com.ar y te lleva al paso que faltó.

Y si algo en esa pantalla te trabó o te confundió, contame qué viste — me ayuda a ajustarlo antes del Mundial.

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
    ? [{ name: "Kevin (test)", email: TEST_RECIPIENT, firstName: "Kevin" }]
    : RECIPIENTS;

  console.log(`\nMode: ${dryRun ? "DRY-RUN" : testOnly ? "TEST" : "LIVE"}`);
  console.log(`Recipients: ${queue.length}\n`);

  for (const [i, r] of queue.entries()) {
    const subject = subjectFor(r);
    const text = bodyFor(r);

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
