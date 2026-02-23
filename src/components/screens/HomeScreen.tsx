"use client";

import { useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Plus, Zap, TrendingUp, Target, Bell, ShoppingBag, Radio, Coins, Loader2 } from "lucide-react";
import XPBar from "@/components/XPBar";
import { useApp } from "@/lib/store";
import { useMatches, useGroups, useUserStats, useLiveMatches, deriveLevel } from "@/lib/hooks";
import { currentUser as mockUser, matches as mockMatches, groups as mockGroups } from "@/lib/mock-data";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
} as const;

export default function HomeScreen({ onNavigate }: { onNavigate: (tab: string, data?: Record<string, string>) => void }) {
  const { setScreen, unreadCount, coins, dbUser, setLiveMatchId, authFetch } = useApp();
  const pushPromptedRef = useRef(false);

  // Prompt for push notifications on first load
  useEffect(() => {
    if (pushPromptedRef.current) return;
    pushPromptedRef.current = true;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    // Delay prompt slightly
    const timer = setTimeout(async () => {
      try {
        const { subscribeToPush } = await import("@/lib/push-client");
        await subscribeToPush(authFetch);
      } catch {
        // Push not supported or denied
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [authFetch]);
  const { matches: apiMatches, loading: matchesLoading } = useMatches();
  const { groups: apiGroups, loading: groupsLoading } = useGroups();
  const { stats } = useUserStats();
  const { matches: liveMatches } = useLiveMatches(60000);

  // User data from dbUser or fallback to mock
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
    };
  }, [dbUser, stats]);

  // Matches from API or mock
  const matches = useMemo(() => {
    if (apiMatches.length > 0) return apiMatches;
    return mockMatches;
  }, [apiMatches]);

  // Groups from API or mock
  const groups = useMemo(() => {
    if (apiGroups.length > 0) {
      return apiGroups.map((g) => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        tournament: g.tournament,
        members: g.memberCount,
        userPosition: 0,
        userPoints: 0,
        maxPoints: 100,
        hasPool: g.hasPool,
        poolAmount: 0,
        currency: g.currency,
        entryFee: g.entryFee,
        poolDistribution: [50, 30, 20] as [number, number, number],
      }));
    }
    return mockGroups;
  }, [apiGroups]);

  const nextMatch = matches.find((m) => m.status === "upcoming" && !m.userPrediction);
  const predictedCount = matches.filter((m) => m.status === "upcoming" && m.userPrediction).length;
  const totalUpcoming = matches.filter((m) => m.status === "upcoming").length;

  return (
    <motion.div
      className="space-y-6 pb-6"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full border-2 border-primary/40 bg-bg-surface flex items-center justify-center text-xl shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            {user.avatar}
          </div>
          <div>
            <h1 className="font-display text-base font-bold tracking-widest text-primary">
              ARMATUPRODE
            </h1>
            <p className="text-sm text-text-secondary">
              Hola, {user.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScreen("shop")}
            className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1.5 transition-all hover:bg-accent/20"
          >
            <Coins size={13} className="text-accent" />
            <span className="font-display text-xs font-bold text-accent">{coins}</span>
          </button>

          <div className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1.5">
            <span className="text-sm animate-fire">🔥</span>
            <span className="font-display text-xs font-bold text-accent">{user.streak}</span>
          </div>

          <button
            onClick={() => setScreen("notifications")}
            className="relative h-9 w-9 rounded-full border border-border-default bg-bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* XP Bar */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-border-default bg-bg-surface p-4">
        <XPBar
          level={user.level}
          levelName={user.levelName}
          xp={user.xp}
          xpNext={user.xpNext}
        />
      </motion.div>

      {/* Next Match CTA */}
      {nextMatch && (
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-bg-surface via-bg-surface to-primary/5 p-6 md:p-8"
          style={{ boxShadow: "0 0 40px rgba(16,185,129,0.08)" }}
        >
          <div className="absolute top-0 right-0 h-28 w-28 rounded-bl-[3rem] bg-primary/[0.04]" />
          <div className="absolute bottom-0 left-0 h-16 w-16 rounded-tr-[2rem] bg-secondary/[0.03]" />

          <div className="flex items-center gap-2 text-xs text-primary font-display font-bold tracking-widest mb-5">
            <Zap size={14} className="animate-pulse" />
            PROXIMO PARTIDO
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="text-center flex-1">
              <div className="text-4xl mb-2">{nextMatch.teamA.flag}</div>
              <div className="font-display text-base font-bold tracking-wider">
                {nextMatch.teamA.code}
              </div>
              <div className="text-xs text-text-muted mt-0.5">{nextMatch.teamA.name}</div>
            </div>
            <div className="px-5">
              <div className="font-display text-xl font-bold text-text-muted/50 tracking-[0.3em]">
                VS
              </div>
              <div className="text-xs text-text-muted text-center mt-1 font-mono">
                {nextMatch.time}hs
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-4xl mb-2">{nextMatch.teamB.flag}</div>
              <div className="font-display text-base font-bold tracking-wider">
                {nextMatch.teamB.code}
              </div>
              <div className="text-xs text-text-muted mt-0.5">{nextMatch.teamB.name}</div>
            </div>
          </div>

          <button
            onClick={() => onNavigate("matches")}
            className="w-full rounded-xl bg-primary py-3.5 font-display text-sm font-bold tracking-widest text-bg-primary transition-all hover:bg-primary/90 active:scale-[0.98]"
            style={{ boxShadow: "0 0 24px rgba(16,185,129,0.25)" }}
          >
            PREDECIR AHORA
          </button>

          <div className="mt-3 text-center text-xs text-text-muted">
            {predictedCount}/{totalUpcoming} predicciones completadas
          </div>
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3 md:gap-4">
        <button
          onClick={() => onNavigate("ranking")}
          className="rounded-2xl border border-border-default bg-bg-surface p-4 text-center transition-all hover:border-secondary/30 active:scale-[0.97]"
        >
          <TrendingUp size={18} className="mx-auto mb-2 text-secondary" />
          <div className="font-display text-xl font-bold text-secondary">
            #{user.globalRank.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1 font-display tracking-wider">RANKING</div>
        </button>
        <div className="rounded-2xl border border-border-default bg-bg-surface p-4 text-center">
          <Target size={18} className="mx-auto mb-2 text-accent" />
          <div className="font-display text-xl font-bold text-accent">
            {user.precision}%
          </div>
          <div className="text-[10px] text-text-muted mt-1 font-display tracking-wider">PRECISION</div>
        </div>
        <div className="rounded-2xl border border-border-default bg-bg-surface p-4 text-center">
          <div className="text-lg mb-1.5">🎯</div>
          <div className="font-display text-xl font-bold text-text-primary">
            {user.exactos}
          </div>
          <div className="text-[10px] text-text-muted mt-1 font-display tracking-wider">EXACTOS</div>
        </div>
      </motion.div>

      {/* Groups */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm font-bold tracking-widest text-text-primary">
            MIS GRUPOS
          </h2>
          <button
            onClick={() => onNavigate("groups")}
            className="text-xs text-primary font-semibold flex items-center gap-0.5 hover:underline"
          >
            Ver todos <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x md:grid md:grid-cols-3 md:overflow-visible">
          {groupsLoading ? (
            <div className="flex items-center justify-center py-8 col-span-3">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => onNavigate("groups", { groupId: group.id })}
                  className="min-w-[155px] snap-start rounded-2xl border border-border-default bg-bg-surface p-4 text-left transition-all hover:border-primary/20 hover:bg-bg-surface-hover active:scale-[0.97]"
                >
                  <div className="text-2xl mb-2">{group.emoji}</div>
                  <div className="text-sm font-bold truncate">{group.name}</div>
                  <div className="text-xs text-text-muted mt-1">{group.members} miembros</div>
                  {group.hasPool && (
                    <div className="mt-2 text-[10px] text-accent font-semibold">
                      💰 ${group.poolAmount.toLocaleString()}
                    </div>
                  )}
                </button>
              ))}
              <button
                onClick={() => onNavigate("groups", { action: "create" })}
                className="min-w-[155px] snap-start rounded-2xl border border-dashed border-border-default bg-bg-surface/30 p-4 flex flex-col items-center justify-center gap-2.5 text-text-muted transition-all hover:border-primary/30 hover:text-primary active:scale-[0.97]"
              >
                <Plus size={28} strokeWidth={1.5} />
                <span className="text-xs font-bold">Crear grupo</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Live Match Banner */}
      {liveMatches.length > 0 && (
        <motion.div variants={fadeUp}>
          {liveMatches.map((lm) => (
            <button
              key={lm.id}
              onClick={() => { setLiveMatchId(lm.id); setScreen("live-match"); }}
              className="w-full rounded-2xl border border-danger/30 bg-gradient-to-r from-danger/10 via-bg-surface to-danger/5 p-4 flex items-center gap-4 transition-all hover:border-danger/40 active:scale-[0.99] mb-2"
            >
              <div className="relative shrink-0">
                <Radio size={20} className="text-danger" />
                <motion.div
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-danger"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-display text-xs font-bold tracking-widest text-danger">EN VIVO</span>
                </div>
                <div className="text-sm font-bold mt-0.5">
                  {lm.teamAFlag} {lm.teamACode} {lm.scoreA ?? 0} - {lm.scoreB ?? 0} {lm.teamBCode} {lm.teamBFlag}
                </div>
              </div>
              <div className="text-xs text-text-muted">
                Ver <ChevronRight size={14} className="inline" />
              </div>
            </button>
          ))}
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div variants={fadeUp} className="flex gap-3 md:gap-4">
        <button
          onClick={() => setScreen("shop")}
          className="flex-1 rounded-2xl border border-border-default bg-bg-surface p-4 flex items-center gap-3 transition-all hover:border-accent/30 active:scale-[0.98]"
        >
          <ShoppingBag size={18} className="text-accent" />
          <div className="text-left">
            <div className="text-sm font-bold">Tienda</div>
            <div className="text-[10px] text-text-muted">Boosters y coins</div>
          </div>
        </button>
        <button
          onClick={() => setScreen("join-group")}
          className="flex-1 rounded-2xl border border-border-default bg-bg-surface p-4 flex items-center gap-3 transition-all hover:border-primary/30 active:scale-[0.98]"
        >
          <Plus size={18} className="text-primary" />
          <div className="text-left">
            <div className="text-sm font-bold">Unirse</div>
            <div className="text-[10px] text-text-muted">Con codigo</div>
          </div>
        </button>
      </motion.div>

      {/* Recent Results */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display text-sm font-bold tracking-widest text-text-primary mb-4">
          ULTIMOS RESULTADOS
        </h2>
        <div className="space-y-2.5">
          {matches
            .filter((m) => m.status === "finished")
            .slice(0, 3)
            .map((match) => (
              <div
                key={match.id}
                className="rounded-2xl border border-border-default bg-bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 flex-1">
                    <span className="text-xl">{match.teamA.flag}</span>
                    <span className="font-display text-xs font-bold tracking-wider">{match.teamA.code}</span>
                  </div>
                  <div className="px-4 text-center">
                    <span className="font-display text-lg font-bold tracking-wider">
                      {match.scoreA ?? "-"} - {match.scoreB ?? "-"}
                    </span>
                    <div className="text-[10px] text-text-muted mt-0.5">Final</div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-1 justify-end">
                    <span className="font-display text-xs font-bold tracking-wider">{match.teamB.code}</span>
                    <span className="text-xl">{match.teamB.flag}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border-default flex items-center justify-between">
                  <span className="text-xs text-text-muted">
                    Tu prediccion: <span className="font-mono font-bold text-text-secondary">{match.userPrediction?.scoreA}-{match.userPrediction?.scoreB}</span>
                  </span>
                  {match.pointsEarned !== undefined && (
                    <span
                      className={`font-display text-xs font-bold px-3 py-1 rounded-full ${
                        match.pointsEarned === 3
                          ? "bg-accent/15 text-accent border border-accent/20"
                          : match.pointsEarned === 1
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "bg-danger/15 text-danger border border-danger/20"
                      }`}
                    >
                      {match.pointsEarned === 3 ? "🎯 EXACTO +3" : match.pointsEarned === 1 ? "✅ Ganador +1" : "❌ 0"}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
