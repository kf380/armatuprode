import { Resend } from "resend";
import { log } from "@/lib/log";

const FROM = "Kevin <hola@armatuprode.com.ar>";

export function prettifyFirstName(name: string): string {
  const raw = (name.trim().split(/\s+/)[0] || name).trim();
  if (!raw) return name;
  // Si está todo en mayúsculas (ej "AGUAS"), o muy desprolijo (ej "marO"),
  // lo normalizamos a Capitalizado.
  const allCaps = raw === raw.toUpperCase();
  const mixed = raw !== raw.toLowerCase() && raw !== raw[0].toUpperCase() + raw.slice(1).toLowerCase();
  if (allCaps || mixed) {
    return raw[0].toUpperCase() + raw.slice(1).toLowerCase();
  }
  return raw;
}

const firstNameOf = prettifyFirstName;

const buildSubject = (firstName: string) =>
  `${firstName}, bienvenido a Armatuprode`;

const buildBody = (firstName: string) => `Hola ${firstName}, ¿cómo estás?

Soy Kevin, estoy detrás de Armatuprode.

Acabás de crear tu cuenta — gracias por anotarte. El Mundial arranca el 11 de junio (Mexico vs South Africa), así que tenés un par de días para armar todo.

Mientras tanto podés:
• Crear un grupo y compartir el link con amigos para jugar juntos
• Unirte a uno con un código que te pasen
• Mirar el calendario completo de partidos

Si te trabás en algo o algo no se entiende, respondé este mail directo. Estoy puliendo cosas antes del primer partido y tu feedback me sirve.

Gracias,
Kevin`;

export async function sendWelcomeEmail(opts: { email: string; name: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log("warn", "welcome_email_skipped_no_api_key", { email: opts.email });
    return;
  }

  const firstName = firstNameOf(opts.name);
  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.email,
      subject: buildSubject(firstName),
      text: buildBody(firstName),
    });
    if (result.error) {
      log("warn", "welcome_email_send_failed", { email: opts.email, error: String(result.error) });
      return;
    }
    log("info", "welcome_email_sent", { email: opts.email, messageId: result.data?.id });
  } catch (e) {
    log("warn", "welcome_email_exception", { email: opts.email, error: String(e) });
  }
}
