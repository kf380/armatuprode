/**
 * Server-side PostHog wrapper. Used from API routes. Flushes immediately
 * so serverless functions don't drop events on shutdown.
 */
import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (client) return client;
  const key = process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  client = new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export async function trackServer(
  userId: string | null,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({
      distinctId: userId ?? "anon",
      event,
      properties,
    });
    await c.flush();
  } catch {
    /* swallowed */
  }
}
