"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Plus, Zap, TrendingUp, Target, Bell, ShoppingBag, Radio, Coins, Loader2, CalendarClock } from "lucide-react";
import XPBar from "@/components/XPBar";
import { useApp } from "@/lib/store";
import { useMatches, useGroups, useUserStats, useLiveMatches, useUserBadges, deriveLevel, usePlayerPremium, usePublicConfig } from "@/lib/hooks";
import PullToRefresh from "@/components/PullToRefresh";
import { calculatePoints } from "@/lib/scoring";
import { Crown } from "lucide-react";
// Mock fallbacks removed: only `currentUser` is kept as a default-shape source while the
// real user is loading. Matches/groups must come from the API — never show fakes in prod.
import { currentUser as mockUser } from "@/lib/mock-data";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
} as const;

export default function HomeScreen({ onNavigate }: { onNavigate: (tab: string, data?: Record<string, string>) => void }) {
  const { setScreen, unreadCount, coins, dbUser, setLiveMatchId, setActiveTab, authFetch } = useApp();
  const { config } = usePublicConfig();
  const { isPremium } = usePlayerPremium();
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
  const { matches: apiMatches, loading: matchesLoading, refetch: refetchMatches } = useMatches();
  const { groups: apiGroups, loading: groupsLoading, refetch: refetchGroups } = useGroups();
  const { stats, refetch: refetchStats } = useUserStats();
  const { matches: liveMatches, refetch: refetchLive } = useLiveMatches(90000);
  const { badges, refetch: refetchBadges } = useUserBadges();

  const handlePullRefresh = async () => {
    await Promise.all([
      refetchMatches?.(),
      refetchGroups?.(),
      refetchStats?.(),
      refetchLive?.(),
      refetchBadges?.(),
    ]);
  };
  const earnedBadges = useMemo(() => badges.filter((b) => b.earned), [badges]);
  const SEEN_KEY = "ap_seen_badges_v1";
  const [unseenBadgeIds, setUnseenBadgeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined" || earnedBadges.length === 0) return;
    const seen = new Set((window.localStorage.getItem(SEEN_KEY) || "").split(",").filter(Boolean));
    const unseen = new Set(earnedBadges.filter((b) => !seen.has(b.id)).map((b) => b.id));
    setUnseenBadgeIds(unseen);
  }, [earnedBadges]);
  const markBadgesSeen = () => {
    if (typeof window === "undefined") return;
    const all = earnedBadges.map((b) => b.id).join(",");
    window.localStorage.setItem(SEEN_KEY, all);
    setUnseenBadgeIds(new Set());
  };

  // Confetti when a match the user predicted just transitioned LIVE → FINISHED
  // with points. Uses a ref so the previous snapshot is per-render-cycle, not
  // per-component-instance (works with the 30s polling inside useMatches).
  const prevMatchStatusesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    let celebrated = false;
    for (const m of apiMatches) {
      const prev = prevMatchStatusesRef.current[m.id];
      const justFinished = (prev === "live" || prev === "upcoming") && m.status === "finished";
      const acertaste = (m.pointsEarned ?? 0) > 0 && !!m.userPrediction;
      if (justFinished && acertaste && !celebrated) {
        celebrated = true;
        import("canvas-confetti").then(({ default: confetti }) => {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ["#10B981", "#F5B82E", "#FAFAF7"] });
          setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.7 } }), 250);
        }).catch(() => {});
        void import("@/lib/sound-fx").then((m) => m.playWinFanfare()).catch(() => {});
      }
      prevMatchStatusesRef.current[m.id] = m.status;
    }
  }, [apiMatches]);

  // Tick every 30s to recompute countdown labels. 30s feels live without
  // re-rendering this big tree every second.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Pick the "next big match" for the countdown banner:
  //   1. Argentina's next upcoming match (if any in next 7 days)
  //   2. Otherwise, the soonest upcoming match in the next 48h
  // Hidden when there's a LIVE match (the LIVE banner takes the slot).
  const nextBigMatch = useMemo(() => {
    if (liveMatches.length > 0) return null;
    const now = Date.now();
    const horizonArg = now + 7 * 86_400_000;
    const horizonGeneric = now + 2 * 86_400_000;
    const upcoming = apiMatches
      .filter((m) => m.status === "upcoming")
      .map((m) => ({ m, kickoff: new Date(m.matchDateIso).getTime() }))
      .filter((x) => x.kickoff > now)
      .sort((a, b) => a.kickoff - b.kickoff);
    const argentina = upcoming.find(
      (x) =>
        x.kickoff < horizonArg &&
        (/argentina/i.test(x.m.teamA.name) || /argentina/i.test(x.m.teamB.name)),
    );
    if (argentina) return argentina;
    const generic = upcoming.find((x) => x.kickoff < horizonGeneric);
    return generic ?? null;
  }, [apiMatches, liveMatches.length]);

  const countdownLabel = useMemo(() => {
    if (!nextBigMatch) return null;
    const diff = nextBigMatch.kickoff - Date.now();
    if (diff <= 0) return null;
    const totalMin = Math.floor(diff / 60_000);
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin % (60 * 24)) / 60);
    const m = totalMin % 60;
    if (d > 0) return `en ${d}d ${h}h`;
    if (h > 0) return `en ${h}h ${m}m`;
    return `en ${m}m`;
  }, [nextBigMatch]);

  // User data from dbUser or fallback to mock (only during initial auth load).
  const user = useMemo(() => {
    if (!dbUser) return { ...mockUser, globalRank: null as number | null, precision: null as number | null, statsLoaded: false };
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
      // Stats: never fall back to mock data for real users. Show 0 / null
      // and let the UI render skeleton placeholders while loading.
      points: stats?.points ?? 0,
      globalRank: stats?.globalRank ?? null,
      streak: stats?.streak ?? 0,
      precision: stats?.precision ?? null,
      exactos: stats?.exactos ?? 0,
      statsLoaded: !!stats,
    };
  }, [dbUser, stats]);

  // Matches and groups: API only. No mock fallback to avoid showing fake data.
  const matches = apiMatches;

  const groups = useMemo(() => {
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
  }, [apiGroups]);

  const nextMatch = matches.find((m) => m.status === "upcoming" && !m.userPrediction);
  const predictedCount = matches.filter((m) => m.status === "upcoming" && m.userPrediction).length;
  const totalUpcoming = matches.filter((m) => m.status === "upcoming").length;

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    <motion.div
      className="space-y-6 pb-6"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between gap-2 pt-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 shrink">
          <div className="h-10 w-10 shrink-0 rounded-full border-2 border-primary/40 bg-bg-surface flex items-center justify-center text-lg shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            {user.avatar}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-sm font-bold tracking-wider text-primary truncate">
              ARMATUPRODE
            </h1>
            <p className="text-xs text-text-secondary truncate">
              Hola, {user.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setScreen("shop")}
            className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-1 transition-all hover:bg-accent/20"
          >
            <Coins size={12} className="text-accent" />
            <span className="font-display text-[10px] font-bold text-accent">{coins}</span>
          </button>

          <div className="flex items-center gap-0.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-1">
            <span className="text-xs animate-fire">🔥</span>
            <span className="font-display text-[10px] font-bold text-accent">{user.streak}</span>
          </div>

          <button
            onClick={() => setScreen("notifications")}
            className="relative h-8 w-8 shrink-0 rounded-full border border-border-default bg-bg-surface flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Premium banner — only when feature flag is on AND user is not yet premium */}
      {config?.flags.enablePlayerPremium && !isPremium && (
        <motion.a
          href="/premium"
          variants={fadeUp}
          className="block rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 to-primary/10 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="size-10 shrink-0 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
              <Crown size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-xs font-bold tracking-wider text-accent mb-0.5">
                ARMATUPRODE PREMIUM
              </div>
              <div className="text-[11px] text-text-secondary">
                Insights, stats y comodines · USD 2 por torneo
              </div>
            </div>
            <ChevronRight size={16} className="text-accent shrink-0" />
          </div>
        </motion.a>
      )}

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
            {user.globalRank != null ? `#${user.globalRank.toLocaleString()}` : (user.statsLoaded ? "—" : "…")}
          </div>
          <div className="text-[10px] text-text-muted mt-1 font-display tracking-wider">RANKING</div>
        </button>
        <div className="rounded-2xl border border-border-default bg-bg-surface p-4 text-center">
          <Target size={18} className="mx-auto mb-2 text-accent" />
          <div className="font-display text-xl font-bold text-accent">
            {user.precision != null ? `${user.precision}%` : (user.statsLoaded ? "—" : "…")}
          </div>
          <div className="text-[10px] text-text-muted mt-1 font-display tracking-wider">PRECISION</div>
        </div>
        <div className="rounded-2xl border border-border-default bg-bg-surface p-4 text-center">
          <div className="text-lg mb-1.5">🎯</div>
          <div className="font-display text-xl font-bold text-text-primary">
            {user.statsLoaded ? user.exactos : "…"}
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
            <div className="flex gap-3 col-span-3 w-full">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex-1 min-w-[160px] h-[112px] rounded-2xl border border-border-default bg-gradient-to-br from-bg-surface to-bg-primary/40 animate-pulse"
                />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="col-span-3 w-full">
              <button
                onClick={() => onNavigate("groups", { action: "create" })}
                className="w-full rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-bg-surface p-6 text-center transition-all hover:border-primary/50 active:scale-[0.99]"
              >
                <div className="text-4xl mb-3">🏆</div>
                <div className="font-display text-sm font-bold tracking-wider mb-1">
                  TODAVÍA NO TENÉS GRUPO
                </div>
                <div className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto mb-4">
                  Creá uno en 30 segundos y pasale el link a tus amigos por WhatsApp.
                  El prode arranca cuando son al menos 2.
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-bg-primary font-display text-xs font-bold tracking-widest">
                  <Plus size={14} /> CREAR MI PRIMER GRUPO
                </div>
              </button>
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

      {/* Streak callout — only when streak is interesting (>=2 correct) */}
      {user.statsLoaded && user.streak >= 2 && (
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 p-3 flex items-center gap-3"
        >
          <span className="text-2xl animate-fire">🔥</span>
          <div className="flex-1">
            <div className="font-display text-xs font-bold text-accent tracking-wider">
              ¡{user.streak} {user.streak === 1 ? "ACIERTO" : "ACIERTOS"} SEGUIDO{user.streak === 1 ? "" : "S"}!
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              {user.streak >= 5
                ? "Estás imparable. Cargá la próxima y rompé tu récord."
                : user.streak >= 3
                ? "No la cortes. Próximo partido te espera."
                : "Vas en racha. Mantenela con el próximo pronóstico."}
            </div>
          </div>
        </motion.div>
      )}

      {/* Countdown banner — only shown when no live match is taking the slot */}
      {nextBigMatch && countdownLabel && (
        <motion.div variants={fadeUp}>
          <button
            onClick={() => setActiveTab("matches")}
            className="w-full rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/5 via-bg-surface to-primary/5 p-4 flex items-center gap-4 transition-all hover:border-primary/40 active:scale-[0.99] mb-2 text-left"
          >
            <CalendarClock size={20} className="text-primary shrink-0" />
            <div className="flex-1">
              <div className="font-display text-[10px] font-bold tracking-widest text-primary">
                PRÓXIMO PARTIDO
              </div>
              <div className="text-sm font-bold mt-0.5">
                {nextBigMatch.m.teamA.flag} {nextBigMatch.m.teamA.code} vs {nextBigMatch.m.teamB.code} {nextBigMatch.m.teamB.flag}
              </div>
              <div className="text-xs text-text-muted mt-0.5">{countdownLabel}</div>
            </div>
            <ChevronRight size={14} className="text-text-muted shrink-0" />
          </button>
        </motion.div>
      )}

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
                  {lm.teamAFlag} {lm.teamACode}{" "}
                  <motion.span
                    key={`${lm.id}-${lm.scoreA ?? 0}-${lm.scoreB ?? 0}`}
                    initial={{ scale: 1.6, color: "#10B981" }}
                    animate={{ scale: 1, color: "var(--color-text-primary, currentColor)" }}
                    transition={{ duration: 0.7 }}
                    className="inline-block"
                  >
                    {lm.scoreA ?? 0} - {lm.scoreB ?? 0}
                  </motion.span>{" "}
                  {lm.teamBCode} {lm.teamBFlag}
                  {lm.minute != null && <span className="text-danger ml-2 text-xs">{lm.minute}&apos;</span>}
                </div>
                {(() => {
                  const myMatch = apiMatches.find((m) => m.id === lm.id);
                  const pred = myMatch?.userPrediction;
                  if (!pred) return null;
                  const liveProjected = calculatePoints(
                    pred.scoreA,
                    pred.scoreB,
                    lm.scoreA ?? 0,
                    lm.scoreB ?? 0,
                    myMatch?.phase,
                    pred.predictedQualifier ?? null,
                    null,
                  );
                  if (liveProjected === 0) {
                    return (
                      <div className="text-[10px] text-text-muted mt-1">
                        Tu pronóstico: {pred.scoreA}-{pred.scoreB} · si queda así no sumás
                      </div>
                    );
                  }
                  return (
                    <div className="text-[10px] mt-1">
                      <span className="text-text-muted">Tu pronóstico: {pred.scoreA}-{pred.scoreB} · </span>
                      <span className="text-primary font-bold">si queda así ganás +{liveProjected} pts</span>
                    </div>
                  );
                })()}
              </div>
              <div className="text-xs text-text-muted">
                Ver <ChevronRight size={14} className="inline" />
              </div>
            </button>
          ))}
        </motion.div>
      )}

      {/* Logros del user — solo se muestra si tiene al menos 1 badge ganado */}
      {earnedBadges.length > 0 && (
        <motion.div variants={fadeUp} className="rounded-2xl border border-border-default bg-bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display text-xs font-bold tracking-widest text-text-secondary">
              TUS LOGROS{unseenBadgeIds.size > 0 && (
                <span className="ml-2 inline-block rounded-full bg-accent/20 border border-accent/40 text-accent px-1.5 py-0.5 text-[9px]">
                  +{unseenBadgeIds.size} NUEVO{unseenBadgeIds.size > 1 ? "S" : ""}
                </span>
              )}
            </div>
            {unseenBadgeIds.size > 0 && (
              <button onClick={markBadgesSeen} className="text-[10px] text-text-muted hover:text-text-primary">
                marcar visto
              </button>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            {earnedBadges.slice(0, 6).map((b) => {
              const isNew = unseenBadgeIds.has(b.id);
              return (
                <div
                  key={b.id}
                  className={`relative flex flex-col items-center w-[68px] text-center ${isNew ? "" : ""}`}
                  title={b.description}
                >
                  <motion.div
                    initial={isNew ? { scale: 0.6 } : false}
                    animate={isNew ? { scale: [1, 1.1, 1] } : {}}
                    transition={isNew ? { duration: 1.2, repeat: Infinity } : undefined}
                    className={`h-12 w-12 rounded-full flex items-center justify-center text-2xl ${
                      isNew
                        ? "bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/50 shadow-[0_0_15px_rgba(245,184,46,0.4)]"
                        : "bg-bg-primary border border-border-default"
                    }`}
                  >
                    {b.icon}
                  </motion.div>
                  <div className="text-[9px] mt-1 leading-tight font-display tracking-wider">
                    {b.name}
                  </div>
                </div>
              );
            })}
          </div>
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
    </PullToRefresh>
  );
}
