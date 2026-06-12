import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Browser tracing samples 10% of sessions to keep free tier comfortable.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replays disabled by default to stay well under quota; flip if needed.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    // Don't capture noisy expected events.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Non-Error promise rejection captured",
    ],
  });
}
