"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";

export default function SplashScreen() {
  const { screen, authLoading } = useApp();
  const navigatedRef = useRef(false);

  // Navigate away as soon as auth resolves (min 800ms for animation)
  // Or force-navigate after 4s regardless (timeout safety)
  useEffect(() => {
    if (navigatedRef.current) return;
    if (screen !== "splash") return;

    // Auth resolved — go immediately (store already sets screen in its own effect)
    if (!authLoading) {
      navigatedRef.current = true;
      return;
    }

    // Safety timeout: if auth is still loading after 4s, it will resolve on its own
    // The store's auth listener handles navigation, so we don't need to force it here
    const timeout = setTimeout(() => {
      // authLoading will eventually resolve and store handles navigation
    }, 4000);

    return () => clearTimeout(timeout);
  }, [authLoading, screen]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 mx-auto max-w-lg md:max-w-xl w-full">
      {/* Logo animation */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center"
      >
        <motion.div
          className="text-7xl mb-6"
          animate={{ rotateY: [0, 360] }}
          transition={{ duration: 2, ease: "easeInOut" }}
        >
          ⚽
        </motion.div>

        <motion.h1
          className="font-display text-3xl font-bold tracking-[0.25em] text-primary"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          ARMATUPRODE
        </motion.h1>

        <motion.p
          className="mt-3 text-base text-text-secondary tracking-wide"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          Competencia social futbolistica
        </motion.p>
      </motion.div>

      {/* Loading bar */}
      <motion.div
        className="mt-16 h-1 w-48 overflow-hidden rounded-full bg-border-default"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.4, duration: 1.2, ease: "easeInOut" }}
          style={{ boxShadow: "0 0 10px rgba(16,185,129,0.5)" }}
        />
      </motion.div>
    </div>
  );
}
