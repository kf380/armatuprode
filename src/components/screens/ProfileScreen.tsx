"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Settings, Share2, ChevronRight } from "lucide-react";
import XPBar from "@/components/XPBar";
import { useApp } from "@/lib/store";
import { useUserStats, useUserBadges, deriveLevel } from "@/lib/hooks";
import { getReferralContent } from "@/lib/share";
import ShareButton from "@/components/ShareButton";
import { currentUser as mockUser, badges as mockBadges, levels } from "@/lib/mock-data";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
} as const;

export default function ProfileScreen() {
  const { dbUser, setActiveTab, setScreen } = useApp();
  const { stats } = useUserStats();
  const { badges: apiBadges, loading: badgesLoading } = useUserBadges();

  const user = useMemo(() => {
    if (!dbUser) return mockUser;
    const { level, levelName, xpNext } = deriveLevel(dbUser.xp);
    return {
      ...mockUser,
      id: dbUser.id,
      name: dbUser.name,
      avatar: dbUser.avatar,
      country: dbUser.country,
      countryName: dbUser.countryName,
      xp: dbUser.xp,
      level,
      levelName,
      xpNext,
      points: stats?.points ?? mockUser.points,
      globalRank: stats?.globalRank ?? mockUser.globalRank,
      streak: stats?.streak ?? mockUser.streak,
      precision: stats?.precision ?? mockUser.precision,
      exactos: stats?.exactos ?? mockUser.exactos,
      predictions: stats?.predictions ?? mockUser.predictions,
    };
  }, [dbUser, stats]);

  const badges = apiBadges.length > 0 ? apiBadges : mockBadges;
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <motion.div className="space-y-6 pb-6" variants={stagger} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
        <h1 className="font-display text-xl font-bold tracking-widest">MI PERFIL</h1>
        <button className="h-8 w-8 rounded-full border border-border-default flex items-center justify-center text-text-muted hover:text-text-primary">
          <Settings size={16} />
        </button>
      </motion.div>

      {/* Profile card */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-border-default bg-bg-surface p-6 text-center"
      >
        <div
          className="mx-auto mb-3 h-20 w-20 rounded-full border-2 border-primary/50 bg-bg-primary flex items-center justify-center text-4xl"
          style={{ boxShadow: "0 0 20px rgba(16,185,129,0.2)" }}
        >
          {user.avatar}
        </div>
        <h2 className="text-xl font-bold">{user.name}</h2>
        <p className="text-sm text-text-muted">{user.country} {user.countryName}</p>
        <div className="mt-3">
          <XPBar
            level={user.level}
            levelName={user.levelName}
            xp={user.xp}
            xpNext={user.xpNext}
          />
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-border-default bg-bg-surface p-3.5 text-center">
          <div className="font-display text-2xl font-bold text-primary">{user.points}</div>
          <div className="text-[10px] font-display tracking-widest text-text-muted">PUNTOS</div>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-surface p-3.5 text-center">
          <div className="font-display text-2xl font-bold text-secondary">#{user.globalRank.toLocaleString()}</div>
          <div className="text-[10px] font-display tracking-widest text-text-muted">RANKING</div>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-surface p-3.5 text-center">
          <div className="font-display text-2xl font-bold text-accent">
            {user.streak} <span className="animate-fire">🔥</span>
          </div>
          <div className="text-[10px] font-display tracking-widest text-text-muted">RACHA</div>
        </div>
        <div className="rounded-xl border border-border-default bg-bg-surface p-3.5 text-center">
          <div className="font-display text-2xl font-bold text-text-primary">{user.precision}%</div>
          <div className="text-[10px] font-display tracking-widest text-text-muted">PRECISION</div>
        </div>
      </motion.div>

      {/* Badges */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-bold tracking-wider">
            LOGROS ({earnedCount}/{badges.length})
          </h2>
        </div>
        <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {badges.map((badge) => (
            <div
              key={badge.id}
              className={`relative rounded-xl border p-2 text-center transition-all ${
                badge.earned
                  ? "border-accent/30 bg-accent/5"
                  : "border-border-default bg-bg-surface opacity-40"
              }`}
            >
              <div className={`text-2xl ${badge.earned ? "" : "grayscale"}`}>{badge.icon}</div>
              <div className="text-[8px] font-display tracking-wider text-text-muted mt-0.5 truncate">
                {badge.name}
              </div>
              {badge.earned && (
                <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-[7px] text-bg-primary font-bold">✓</span>
                </div>
              )}
              {!badge.earned && (
                <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-bg-primary">
                  <div
                    className="h-full rounded-full bg-text-muted/30"
                    style={{ width: `${Math.min(100, (badge.progress / badge.target) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Levels progress */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display text-sm font-bold tracking-wider mb-3">NIVELES</h2>
        <div className="space-y-1.5">
          {levels.map((lvl) => {
            const reached = user.xp >= lvl.xp;
            const isCurrent = lvl.level === user.level;
            return (
              <div
                key={lvl.level}
                className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                  isCurrent
                    ? "border-primary/40 bg-primary/5"
                    : reached
                    ? "border-border-default bg-bg-surface"
                    : "border-border-default bg-bg-surface opacity-40"
                }`}
              >
                <span className={`font-display text-xs font-bold w-10 ${isCurrent ? "text-primary" : reached ? "text-accent" : "text-text-muted"}`}>
                  Nv.{lvl.level}
                </span>
                <span className={`text-sm flex-1 ${isCurrent ? "font-bold text-primary" : ""}`}>
                  {lvl.name}
                </span>
                <span className="text-xs text-text-muted font-mono">{lvl.xp.toLocaleString()} XP</span>
                {reached && <span className="text-xs">✅</span>}
                {isCurrent && <span className="text-xs">◀</span>}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* XP guide */}
      <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
        <h3 className="font-display text-xs font-bold tracking-wider mb-3">COMO GANAR XP</h3>
        <div className="space-y-2 text-xs">
          {[
            { action: "Hacer prediccion", xp: "+10 XP" },
            { action: "Acierto ganador", xp: "+20 XP" },
            { action: "Resultado exacto", xp: "+50 XP" },
            { action: "Completar toda la fecha", xp: "+20 XP" },
            { action: "Racha de 5", xp: "+100 XP" },
            { action: "Invitar amigo", xp: "+30 XP" },
          ].map((item) => (
            <div key={item.action} className="flex items-center justify-between">
              <span className="text-text-secondary">{item.action}</span>
              <span className="font-display font-bold text-primary">{item.xp}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Referral */}
      {dbUser && (
        <motion.div variants={fadeUp} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h3 className="font-display text-xs font-bold tracking-wider mb-2">INVITA AMIGOS Y GANA XP</h3>
          <p className="text-xs text-text-secondary mb-3">
            Compartí tu codigo y ganá +30 XP por cada amigo que se una
          </p>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 rounded-lg border border-border-default bg-bg-primary px-3 py-2 font-mono text-sm text-primary">
              {dbUser?.referralCode || "..."}
            </div>
          </div>
          <ShareButton
            content={getReferralContent(dbUser?.referralCode || "")}
            label="COMPARTIR CODIGO"
            variant="primary"
          />
        </motion.div>
      )}

      {/* Actions */}
      <motion.div variants={fadeUp} className="space-y-2">
        <ShareButton
          content={{ text: "Arma tu prode y competi con amigos en ArmatuProde!", url: typeof window !== "undefined" ? window.location.origin : "https://armatuprode.com.ar" }}
          label="INVITAR AMIGOS"
        />
        <button
          onClick={() => setActiveTab("groups")}
          className="w-full rounded-xl border border-border-default bg-bg-surface py-3 text-xs text-text-muted flex items-center justify-center gap-2 hover:bg-bg-surface-hover transition-all"
        >
          Mis grupos <ChevronRight size={14} />
        </button>
        <button
          onClick={() => setScreen("rules")}
          className="w-full rounded-xl border border-border-default bg-bg-surface py-3 text-xs text-text-muted flex items-center justify-center gap-2 hover:bg-bg-surface-hover transition-all"
        >
          Reglas del juego <ChevronRight size={14} />
        </button>
        <button className="w-full rounded-xl border border-border-default bg-bg-surface py-3 text-xs text-text-muted flex items-center justify-center gap-2 hover:bg-bg-surface-hover transition-all">
          Historial completo <ChevronRight size={14} />
        </button>
      </motion.div>
    </motion.div>
  );
}
