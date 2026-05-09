"use client";

import { AppProvider } from "@/lib/store";

/**
 * Organizer panel uses the same AppProvider as the main SPA so we can reuse
 * authFetch + dbUser + the API hooks without duplicating session logic.
 *
 * Trade-off: re-mount of the provider when navigating from `/` to `/organizer`,
 * which costs one extra `/api/users` fetch. Acceptable for an operator panel.
 */
export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen bg-bg-primary text-text-primary">{children}</div>
    </AppProvider>
  );
}
