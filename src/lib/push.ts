/**
 * Server-side push notification sender.
 * Requires web-push package and VAPID keys.
 * Fails gracefully if not configured.
 */
import { prisma } from "@/lib/prisma";

/**
 * Send a push to a user. Optional `tag` permite reemplazar la última
 * notificación con el mismo tag (live-activity style): el SW colapsa la
 * vieja y muestra la nueva. Ideal para partidos en vivo donde el score
 * cambia — el user ve UN ítem en su lock screen que se actualiza, en vez
 * de N notificaciones acumuladas.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  options?: { tag?: string; renotify?: boolean },
) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let webpush: {
    setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
    sendNotification: (
      sub: { endpoint: string; keys: { p256dh: string; auth: string } },
      payload: string,
      opts?: { topic?: string; urgency?: "very-low" | "low" | "normal" | "high"; TTL?: number },
    ) => Promise<void>;
  };
  try {
    webpush = require("web-push");
  } catch {
    return;
  }

  webpush.setVapidDetails("mailto:hola@armatuprode.com.ar", publicKey, privateKey);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const payload = JSON.stringify({
    title,
    body,
    tag: options?.tag,
    renotify: options?.renotify ?? false,
  });

  // Web Push 'topic' header tells the FCM/APNs intermediary to replace any
  // prior message with the same topic still in the queue. Es lo más cerca de
  // "Live Activity" que se puede sin app nativa.
  const webPushOpts = options?.tag
    ? { topic: options.tag.slice(0, 32), urgency: "high" as const, TTL: 30 }
    : undefined;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        webPushOpts,
      );
    } catch {
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }
}
