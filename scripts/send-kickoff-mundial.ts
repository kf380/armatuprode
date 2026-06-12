/**
 * Kick-off mail día de arranque del Mundial. Segmenta por estado:
 *   - SIN_GRUPO: invita a crear grupo y pasar el link por WhatsApp.
 *   - CON_GRUPO: empuja a dejar la pick cargada antes de las 19hs.
 *
 *   npx tsx scripts/send-kickoff-mundial.ts             # dry-run (preview por segmento)
 *   npx tsx scripts/send-kickoff-mundial.ts --test      # solo a TEST_RECIPIENT (las 2 versiones)
 *   npx tsx scripts/send-kickoff-mundial.ts --send      # live (manda a todos)
 *
 * Flags:
 *   --only-no-group    solo a users sin grupo
 *   --only-with-group  solo a users con grupo
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

const firstNameOf = prettifyFirstName;

const STOPWORDS = new Set([
  "el","la","los","las","mi","un","una","sin","con","de","del","mr","sr","sra",
]);

function safeFirstName(name: string): string | null {
  const fn = firstNameOf(name);
  if (!fn) return null;
  if (fn.length < 3) return null;
  if (STOPWORDS.has(fn.toLowerCase())) return null;
  if (!/[aeiouáéíóú]/i.test(fn)) return null;
  if (!/^[a-záéíóúñü'-]+$/i.test(fn)) return null;
  return fn;
}

type Segment = "SIN_GRUPO" | "CON_GRUPO";

const subjectFor = (name: string, seg: Segment) => {
  const fn = safeFirstName(name);
  if (seg === "SIN_GRUPO") {
    return fn ? `${fn}, hoy arranca el Mundial` : `Hoy arranca el Mundial`;
  }
  return fn
    ? `${fn}, cargá tu pronóstico antes del primer partido`
    : `Cargá tu pronóstico antes del primer partido`;
};

const greet = (name: string, q: string) => {
  const fn = safeFirstName(name);
  if (fn) return `${fn}, ${q}`;
  return q.replace(/^(¿?)([a-záéíóú])/, (_, p, c) => p + c.toUpperCase());
};

const bodySinGrupo = (name: string) => `${greet(name, "¿qué hacés?")}

Hoy arranca el Mundial con México vs Sudáfrica.

Si todavía no armaste tu grupo en Armatuprode, este es el momento:

→ Entrá a https://armatuprode.com.ar
→ Creá tu grupo en menos de un minuto
→ Pasale el link por WhatsApp a tu grupo del laburo, del fútbol o la familia

Una vez que arranca el primer partido, ya no se puede cargar el pronóstico de ese encuentro.

Y ojo: el martes 16 juega Argentina. Mejor llegar con el prode armado antes de que empiece la manija.

Si algo no funciona o tenés alguna duda, respondeme este mail y te ayudo.

Kevin`;

const bodyConGrupo = (name: string) => `${greet(name, "¿cómo va?")}

Hoy arranca el Mundial con México vs Sudáfrica.

Ya estás dentro de un grupo en Armatuprode, así que solo te falta entrar y dejar cargado tu pronóstico antes de que empiece el partido:

→ https://armatuprode.com.ar

También podés aprovechar para pasarle el link del grupo a los que todavía faltan. El martes 16 juega Argentina y está bueno llegar con todos adentro antes de ese partido.

Si algo no carga o tenés alguna duda, respondeme este mail y te ayudo.

Kevin`;

const bodyFor = (name: string, seg: Segment) =>
  seg === "SIN_GRUPO" ? bodySinGrupo(name) : bodyConGrupo(name);

const prisma = new PrismaClient();

async function main() {
  const args = new Set(process.argv.slice(2));
  const live = args.has("--send");
  const testOnly = args.has("--test");
  const dryRun = !live && !testOnly;
  const onlyNoGroup = args.has("--only-no-group");
  const onlyWithGroup = args.has("--only-with-group");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey && !dryRun) {
    console.error("Falta RESEND_API_KEY en .env.local");
    process.exit(1);
  }
  const resend = apiKey ? new Resend(apiKey) : null;

  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      createdAt: true,
      _count: { select: { memberships: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  type Q = { email: string; name: string; segment: Segment };
  let queue: Q[];

  if (testOnly) {
    queue = [
      { email: TEST_RECIPIENT, name: "Kevin (sin grupo)", segment: "SIN_GRUPO" },
      { email: TEST_RECIPIENT, name: "Kevin (con grupo)", segment: "CON_GRUPO" },
    ];
  } else {
    queue = users
      .filter((u) => !EXCLUDE_EMAILS.has(u.email))
      .map<Q>((u) => ({
        email: u.email,
        name: u.name,
        segment: u._count.memberships > 0 ? "CON_GRUPO" : "SIN_GRUPO",
      }))
      .filter((r) => {
        if (onlyNoGroup) return r.segment === "SIN_GRUPO";
        if (onlyWithGroup) return r.segment === "CON_GRUPO";
        return true;
      });
  }

  const noGroup = queue.filter((r) => r.segment === "SIN_GRUPO").length;
  const withGroup = queue.filter((r) => r.segment === "CON_GRUPO").length;

  console.log(`\nMode: ${dryRun ? "DRY-RUN" : testOnly ? "TEST" : "LIVE"}`);
  console.log(`Recipients: ${queue.length}  (sin grupo: ${noGroup} · con grupo: ${withGroup})\n`);

  if (dryRun) {
    const sample = (seg: Segment) => queue.find((r) => r.segment === seg);
    const s1 = sample("SIN_GRUPO");
    const s2 = sample("CON_GRUPO");
    if (s1) {
      console.log(`--- PREVIEW SIN_GRUPO → ${s1.email} (${s1.name}) ---`);
      console.log(`Subject: ${subjectFor(s1.name, "SIN_GRUPO")}\n${bodyFor(s1.name, "SIN_GRUPO")}\n`);
    }
    if (s2) {
      console.log(`--- PREVIEW CON_GRUPO → ${s2.email} (${s2.name}) ---`);
      console.log(`Subject: ${subjectFor(s2.name, "CON_GRUPO")}\n${bodyFor(s2.name, "CON_GRUPO")}\n`);
    }
    await prisma.$disconnect();
    return;
  }

  for (const [i, r] of queue.entries()) {
    const subject = subjectFor(r.name, r.segment);
    const text = bodyFor(r.name, r.segment);

    try {
      const result = await resend!.emails.send({ from: FROM, to: r.email, subject, text });
      if (result.error) {
        console.error(`[${i + 1}/${queue.length}] FAIL ${r.email}:`, result.error);
      } else {
        console.log(`[${i + 1}/${queue.length}] OK   ${r.email}  [${r.segment}]  id=${result.data?.id}`);
      }
    } catch (e) {
      console.error(`[${i + 1}/${queue.length}] ERR  ${r.email}:`, e);
    }
    if (i < queue.length - 1) await new Promise((res) => setTimeout(res, SEND_INTERVAL_MS));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
