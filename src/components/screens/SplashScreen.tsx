"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";

function ShieldLogo() {
  return (
    <svg
      width="96"
      height="112"
      viewBox="0 0 96 112"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_0_30px_rgba(16,185,129,0.4)]"
    >
      {/* Shield shape */}
      <defs>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="shieldInner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#0A0E1A" />
        </linearGradient>
        <linearGradient id="ballGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F9FAFB" />
          <stop offset="100%" stopColor="#D1D5DB" />
        </linearGradient>
      </defs>

      {/* Outer shield */}
      <path
        d="M48 4L8 22V56C8 80 24 100 48 108C72 100 88 80 88 56V22L48 4Z"
        fill="url(#shieldGrad)"
        stroke="#10B981"
        strokeWidth="1.5"
      />
      {/* Inner shield */}
      <path
        d="M48 10L14 26V56C14 77 28 95 48 102C68 95 82 77 82 56V26L48 10Z"
        fill="url(#shieldInner)"
      />

      {/* Football / soccer ball */}
      <circle cx="48" cy="54" r="20" fill="url(#ballGrad)" opacity="0.95" />
      {/* Pentagon pattern on ball */}
      <path
        d="M48 38L53 44H43L48 38Z M48 70L43 64H53L48 70Z M32 50L36 44L40 50L36 56L32 50Z M64 50L60 44L56 50L60 56L64 50Z M48 48L53 50L51 56H45L43 50L48 48Z"
        fill="#1E293B"
        opacity="0.7"
      />

      {/* Star at top */}
      <path
        d="M48 14L50 19L55 19L51 22L52.5 27L48 24L43.5 27L45 22L41 19L46 19L48 14Z"
        fill="#F59E0B"
        opacity="0.9"
      />
    </svg>
  );
}

export default function SplashScreen() {
  const { screen, setScreen, authLoading } = useApp();

  // Hard cap: if still on splash after 1.5s, force to login
  useEffect(() => {
    if (screen !== "splash") return;

    const timeout = setTimeout(() => {
      if (authLoading) {
        setScreen("login");
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [screen, authLoading, setScreen]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 mx-auto max-w-lg md:max-w-xl w-full overflow-hidden">
      {/* Background pattern — subtle hexagon/field lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(30deg, #10B981 12%, transparent 12.5%, transparent 87%, #10B981 87.5%, #10B981),
            linear-gradient(150deg, #10B981 12%, transparent 12.5%, transparent 87%, #10B981 87.5%, #10B981),
            linear-gradient(30deg, #10B981 12%, transparent 12.5%, transparent 87%, #10B981 87.5%, #10B981),
            linear-gradient(150deg, #10B981 12%, transparent 12.5%, transparent 87%, #10B981 87.5%, #10B981),
            linear-gradient(60deg, #10B98177 25%, transparent 25.5%, transparent 75%, #10B98177 75%, #10B98177),
            linear-gradient(60deg, #10B98177 25%, transparent 25.5%, transparent 75%, #10B98177 75%, #10B98177)
          `,
          backgroundSize: "80px 140px",
          backgroundPosition: "0 0, 0 0, 40px 70px, 40px 70px, 0 0, 40px 70px",
        }}
      />

      {/* Radial glow behind logo */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px]" />

      {/* Logo + text */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 text-center flex flex-col items-center"
      >
        {/* Shield logo */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <ShieldLogo />
        </motion.div>

        {/* App name with gradient */}
        <motion.h1
          className="mt-6 font-display text-3xl font-bold tracking-[0.2em]"
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{
            background: "linear-gradient(135deg, #10B981 0%, #34D399 50%, #059669 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ARMA TU PRODE
        </motion.h1>

        {/* Slogan */}
        <motion.p
          className="mt-3 font-display text-sm tracking-[0.3em] text-text-secondary/80 uppercase"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          Predecí &middot; Competí &middot; Ganá
        </motion.p>
      </motion.div>

      {/* Subtle bottom decoration */}
      <motion.div
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse [animation-delay:0.2s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse [animation-delay:0.4s]" />
      </motion.div>
    </div>
  );
}
