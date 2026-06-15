"use client";

import { useEffect } from "react";

/**
 * Lazy-init de PostHog: 2s después del paint. PostHog cliente pesa ~30 KB
 * gzipped y si lo importás eagerly, entra al bundle inicial y mete latencia
 * al LCP. Diferirlo no afecta tracking porque nadie hace eventos en los
 * primeros 2s (todavía está cargando la app).
 */
export default function AnalyticsBoot() {
  useEffect(() => {
    const id = setTimeout(() => {
      void import("@/lib/analytics").then((m) => m.initAnalyticsClient());
    }, 2000);
    return () => clearTimeout(id);
  }, []);
  return null;
}
