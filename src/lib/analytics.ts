/**
 * Thin wrapper over PostHog so app code uses one signature for both client
 * and server (no-ops when keys absent so dev runs without setup).
 *
 * Client tracking: import { track } from "@/lib/analytics" — lives in
 * client components, uses posthog-js global initialized by AnalyticsBoot.
 *
 * Server tracking: import { trackServer } — uses posthog-node and flushes
 * promptly so serverless functions don't drop events.
 */
"use client";

import posthog from "posthog-js";

let initialized = false;

export function initAnalyticsClient(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    autocapture: false,
  });
  initialized = true;
}

export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (!initialized) initAnalyticsClient();
  if (typeof window === "undefined") return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* swallowed — analytics must never break the app */
  }
}

export function identify(userId: string, properties: Record<string, unknown> = {}): void {
  if (!initialized) initAnalyticsClient();
  if (typeof window === "undefined") return;
  try {
    posthog.identify(userId, properties);
  } catch {
    /* swallowed */
  }
}

export function reset(): void {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {
    /* swallowed */
  }
}
