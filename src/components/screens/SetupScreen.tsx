"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";

const avatars = ["🎮", "⚽", "🏆", "🔥", "⚡", "🎯", "👑", "🦁", "🐺", "🦅", "🎲", "💎"];
const countries = [
  { flag: "🇦🇷", name: "Argentina" },
  { flag: "🇧🇷", name: "Brasil" },
  { flag: "🇲🇽", name: "Mexico" },
  { flag: "🇨🇴", name: "Colombia" },
  { flag: "🇨🇱", name: "Chile" },
  { flag: "🇺🇾", name: "Uruguay" },
  { flag: "🇵🇪", name: "Peru" },
  { flag: "🇪🇸", name: "España" },
  { flag: "🇺🇸", name: "Estados Unidos" },
  { flag: "🇪🇨", name: "Ecuador" },
];

export default function SetupScreen() {
  const { setScreen, setIsLoggedIn, setDbUser, authFetch } = useApp();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🎮");
  const [country, setCountry] = useState("🇦🇷");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canContinue = name.trim().length >= 2;
  const selectedCountry = countries.find((c) => c.flag === country);

  const handleStart = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          avatar,
          country,
          countryName: selectedCountry?.name || "Argentina",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Error ${res.status} al crear perfil`);
        setLoading(false);
        return;
      }

      setDbUser(data.user);
      setIsLoggedIn(true);

      // Apply pending referral code if any
      const pendingRef = localStorage.getItem("pendingRefCode");
      if (pendingRef) {
        localStorage.removeItem("pendingRefCode");
        authFetch("/api/users/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: pendingRef }),
        }).catch(() => {});
      }

      setScreen("main");
    } catch (err) {
      setError(`Error de conexion: ${err instanceof Error ? err.message : "desconocido"}`);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary px-6 py-10 md:mt-12">
      <motion.div
        className="w-full max-w-sm md:max-w-xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className="h-1 flex-1 rounded-full bg-primary" />
          <div className="h-1 flex-1 rounded-full bg-primary" />
          <div className="h-1 flex-1 rounded-full bg-border-default" />
        </div>

        <h1 className="font-display text-xl font-bold tracking-widest mb-1">ARMA TU PERFIL</h1>
        <p className="text-sm text-text-secondary mb-8">Elegí como te van a ver los demas</p>

        {error && (
          <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Avatar selection */}
        <div className="mb-8">
          <label className="text-xs font-display tracking-widest text-text-muted mb-3 block">
            AVATAR
          </label>
          <div className="flex items-center gap-4 mb-4">
            <div
              className="h-20 w-20 rounded-full border-2 border-primary bg-bg-surface flex items-center justify-center text-4xl shrink-0"
              style={{ boxShadow: "0 0 20px rgba(16,185,129,0.2)" }}
            >
              {avatar}
            </div>
            <div className="grid grid-cols-6 gap-2 flex-1">
              {avatars.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                    avatar === a
                      ? "border-2 border-primary bg-primary/10 scale-110"
                      : "border border-border-default bg-bg-surface hover:border-text-muted/30"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="mb-8">
          <label className="text-xs font-display tracking-widest text-text-muted mb-3 block">
            TU NOMBRE
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como te llamas?"
            maxLength={20}
            className="w-full rounded-2xl border border-border-default bg-bg-surface px-5 py-4 text-base text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none transition-colors"
          />
          <p className="mt-2 text-xs text-text-muted text-right">{name.length}/20</p>
        </div>

        {/* Country */}
        <div className="mb-10">
          <label className="text-xs font-display tracking-widest text-text-muted mb-3 block">
            PAIS
          </label>
          <div className="grid grid-cols-5 gap-2">
            {countries.map((c) => (
              <button
                key={c.flag}
                onClick={() => setCountry(c.flag)}
                className={`flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition-all ${
                  country === c.flag
                    ? "border-2 border-primary bg-primary/10"
                    : "border border-border-default bg-bg-surface hover:border-text-muted/30"
                }`}
              >
                <span className="text-2xl">{c.flag}</span>
                <span className="text-[8px] text-text-muted truncate w-full text-center">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={handleStart}
          disabled={!canContinue || loading}
          className={`w-full rounded-2xl py-4 font-display text-sm font-bold tracking-widest transition-all active:scale-[0.98] ${
            canContinue && !loading
              ? "bg-primary text-bg-primary shadow-[0_0_24px_rgba(16,185,129,0.25)]"
              : "bg-border-default text-text-muted cursor-not-allowed"
          }`}
        >
          {loading ? "GUARDANDO..." : "EMPEZAR A JUGAR"}
        </button>
      </motion.div>
    </div>
  );
}
