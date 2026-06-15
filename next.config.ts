import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

// Wrap config only when DSN exists so dev without Sentry doesn't pay for it.
const configWithSentry = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
      tunnelRoute: "/monitoring",
    })
  : nextConfig;

// Bundle analyzer toggle: ANALYZE=true npm run build → abre el reporte HTML.
export default withBundleAnalyzer(configWithSentry);
