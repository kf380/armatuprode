"use client";

import { useEffect } from "react";

/**
 * Mount-once reporter that ships Web Vitals to /api/vitals. Uses keepalive
 * fetch so values flush even on page unload. The web-vitals library only
 * reports each metric once per page load.
 */
export default function WebVitalsReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const report = (metric: { name: string; value: number; rating?: string; id: string }) => {
      if (cancelled) return;
      const payload = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        url: window.location.pathname,
      });
      try {
        // sendBeacon flushes during unload; fallback to fetch keepalive.
        const url = "/api/vitals";
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        } else {
          fetch(url, { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } });
        }
      } catch {
        /* best-effort */
      }
    };

    import("web-vitals").then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
      if (cancelled) return;
      onLCP(report);
      onCLS(report);
      onINP(report);
      onFCP(report);
      onTTFB(report);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, []);
  return null;
}
