/**
 * Server-side push notification sender.
 * Requires web-push package and VAPID keys.
 * Fails gracefully if not configured.
 */
import { prisma } from "@/lib/prisma";

export async function sendPushToUser(userId: string, title: string, body: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let webpush: { setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void; sendNotification: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void> };
  try {
    webpush = require("web-push");
  } catch {
    // web-push not installed yet
    return;
  }

  webpush.setVapidDetails("mailto:hello@armatuprode.com.ar", publicKey, privateKey);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const payload = JSON.stringify({ title, body });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      );
    } catch {
      // Subscription expired or invalid — remove
      await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
    }
  }
}
