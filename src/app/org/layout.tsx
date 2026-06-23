"use client";

import { AppProvider } from "@/lib/store";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen bg-bg-primary text-text-primary">{children}</div>
    </AppProvider>
  );
}
