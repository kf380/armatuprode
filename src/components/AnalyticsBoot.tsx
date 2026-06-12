"use client";

import { useEffect } from "react";
import { initAnalyticsClient } from "@/lib/analytics";

export default function AnalyticsBoot() {
  useEffect(() => {
    initAnalyticsClient();
  }, []);
  return null;
}
