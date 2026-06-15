"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const VISITS_KEY = "ap_visits_count";
const DISMISSED_KEY = "ap_pwa_dismissed_at";
const MIN_VISITS_BEFORE_PROMPT = 2;
const REPROMPT_DAYS = 14;

/**
 * Shows a bottom-banner offering PWA install. Shows up only when:
 *   - beforeinstallprompt fired (Chrome/Edge/Android)
 *   - user has visited at least 2 times
 *   - not dismissed within the last 14 days
 *
 * iOS Safari doesn't fire the event; for iOS we'd need a separate
 * "Add to Home Screen" tooltip (deferred).
 */
export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Bump visit counter once per session.
    if (!sessionStorage.getItem("ap_visit_counted")) {
      const prev = parseInt(localStorage.getItem(VISITS_KEY) ?? "0", 10) || 0;
      localStorage.setItem(VISITS_KEY, String(prev + 1));
      sessionStorage.setItem("ap_visit_counted", "1");
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferred(event);

      const visits = parseInt(localStorage.getItem(VISITS_KEY) ?? "0", 10) || 0;
      const dismissedAt = parseInt(localStorage.getItem(DISMISSED_KEY) ?? "0", 10) || 0;
      const tooSoon = dismissedAt > 0 && Date.now() - dismissedAt < REPROMPT_DAYS * 86_400_000;
      if (visits >= MIN_VISITS_BEFORE_PROMPT && !tooSoon) {
        setVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* user dismissed via OS UI */
    }
    setVisible(false);
    setDeferred(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 22 }}
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] w-[92vw] max-w-md rounded-2xl border border-primary/30 bg-bg-surface p-4 shadow-2xl flex items-center gap-3"
        >
          <Download size={20} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-display text-xs font-bold tracking-wider">Instalá la app</div>
            <div className="text-[11px] text-text-muted leading-snug mt-0.5">
              Push de goles, abre más rápido y queda en tu pantalla.
            </div>
          </div>
          <button
            onClick={handleInstall}
            className="rounded-full bg-primary px-3 py-1.5 text-bg-primary font-display text-[11px] font-bold tracking-wider active:scale-95"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
