"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Plus, Zap, Bell, ShoppingBag, Coins, Loader2, CalendarClock } from "lucide-react";
import XPBar from "@/components/XPBar";
import { useApp } from "@/lib/store";
import { useDashboard, useLiveMatches, deriveLevel, usePublicConfig } from "@/lib/hooks";
import type { ScreenMatch } from "@/lib/hooks";
import { isArgentinaMatch, findNextArgentina, ARGENTINA_COLORS } from "@/lib/argentina-mode";
import PullToRefresh from "@/components/PullToRefresh";
import { calculatePoints } from "@/lib/scoring";
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
  // Single round-trip: stats + matches + groups + liveMatches + badges agregados.
  // Reemplaza 5 fetches concurrentes anteriores que tardaban en frío.
  const { data: dash, loading: dashLoading, refetch: refetchDash } = useDashboard();
  // Live polling cada 90s para el banner LIVE. Se mantiene separado del dashboard
  // porque tiene cadencia propia más agresiva.
  const { matches: livePolled, refetch: refetchLive } = useLiveMatches(90000);

  // Helper para mapear dashboard.matches (raw API shape) al ScreenMatch que
  // espera el resto del componente (lowercase status + formatted time).
  const apiToScreen = (m: NonNullable<typeof dash>["matches"][number]): ScreenMatch => {
    const d = new Date(m.matchDate);
    const time = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires", hour12: false });
    return {
      id: m.id,
      officialMatchNumber: m.officialMatchNumber,
      teamA: { code: m.teamACode, name: m.teamAName, flag: m.teamAFlag },
      teamB: { code: m.teamBCode, name: m.teamBName, flag: m.teamBFlag },
      date: m.matchDate.toString().slice(0, 10),
      matchDateIso: m.matchDate as unknown as string,
      time,
      group: m.matchGroup || m.phase,
      phase: m.phase,
      status: m.status === "UPCOMING" ? "upcoming" : m.status === "FINISHED" ? "finished" : "live",
      scoreA: m.scoreA ?? undefined,
      scoreB: m.scoreB ?? undefined,
      qualifiedTeam: m.qualifiedTeam ?? undefined,
      userPrediction: m.prediction
        ? { scoreA: m.prediction.scoreA, scoreB: m.prediction.scoreB, predictedQualifier: m.prediction.predictedQualifier ?? undefined }
        : null,
      pointsEarned: m.prediction?.points,
    };
  };

  const apiMatches = useMemo(
    () => (dash?.matches ?? []).map(apiToScreen),
    [dash],
  );
  const apiGroups = dash?.groups ?? [];
  const stats = dash?.stats ?? null;
  // Prefer live polled (más fresco). Fallback a dashboard's snapshot mientras
  // useLiveMatches no termina su primer fetch.
  const serverLive = livePolled.length > 0 ? livePolled : (dash?.liveMatches ?? []);

  // "Effectively LIVE" = matches con kickoff pasado y NO FINISHED, aunque el
  // server todavía no los haya marcado como LIVE (cuando el sync se atrasa).
  // Evita que aparezcan como "próximo partido" siendo ya jugados.
  const presumedLive = useMemo(() => {
    const now = Date.now();
    const liveIds = new Set(serverLive.map((l) => l.id));
    return apiMatches.filter(
      (m) =>
        m.status === "upcoming" &&
        new Date(m.matchDateIso).getTime() <= now &&
        !liveIds.has(m.id),
    );
  }, [apiMatches, serverLive]);

  const liveMatches = useMemo(() => {
    // Merge: server-confirmed live first, then presumed-live (without score data).
    const extras = presumedLive.map((m) => ({
      id: m.id,
      teamACode: m.teamA.code,
      teamAName: m.teamA.name,
      teamAFlag: m.teamA.flag,
      teamBCode: m.teamB.code,
      teamBName: m.teamB.name,
      teamBFlag: m.teamB.flag,
      scoreA: m.scoreA ?? null,
      scoreB: m.scoreB ?? null,
      minute: null as number | null,
      period: null as string | null,
      matchGroup: m.group,
      phase: m.phase,
      userPrediction: m.userPrediction
        ? { scoreA: m.userPrediction.scoreA, scoreB: m.userPrediction.scoreB }
        : null,
    }));
    return [...serverLive, ...extras];
  }, [serverLive, presumedLive]);
  // Mini-catálogo cliente para resolver icon + name de cada badge sin pegar al
  // server. Si en el futuro agregamos badges nuevos, sumar la entry acá.
  const BADGE_CATALOG: Record<string, { icon: string; name: string; description: string }> = {
    francotirador: { icon: "🎯", name: "Francotirador", description: "5 resultados exactos" },
    en_racha: { icon: "🔥", name: "En racha", description: "5 aciertos seguidos" },
    visionario: { icon: "🔮", name: "Visionario", description: "10 ganadores correctos" },
    fiel: { icon: "📅", name: "Fiel", description: "Predijo todos los partidos de una fase" },
    organizador: { icon: "👑", name: "Organizador", description: "Creó un grupo" },
    sociable: { icon: "🤝", name: "Sociable", description: "Está en 3 grupos" },
  };
  const badges = useMemo(
    () =>
      (dash?.badges ?? []).map((b) => ({
        id: b.id,
        icon: BADGE_CATALOG[b.id]?.icon ?? "🏅",
        name: BADGE_CATALOG[b.id]?.name ?? b.id,
        description: BADGE_CATALOG[b.id]?.description ?? "",
        earned: true,
        progress: 1,
        target: 1,
      })),
    [dash],
  );
  const matchesLoading = dashLoading && !dash;
  const groupsLoading = dashLoading && !dash;

  const handlePullRefresh = async () => {
    await Promise.all([refetchDash?.(), refetchLive?.()]);
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
  // with points. Argentina-specific celebration: celeste + blanco + big banner.
  const prevMatchStatusesRef = useRef<Record<string, string>>({});
  const [argentinaGoooolFor, setArgentinaGoooolFor] = useState<string | null>(null);
  useEffect(() => {
    let celebrated = false;
    for (const m of apiMatches) {
      const prev = prevMatchStatusesRef.current[m.id];
      const justFinished = (prev === "live" || prev === "upcoming") && m.status === "finished";
      const acertaste = (m.pointsEarned ?? 0) > 0 && !!m.userPrediction;
      if (justFinished && acertaste && !celebrated) {
        celebrated = true;
        const isArg = isArgentinaMatch(m);
        const isExact =
          m.userPrediction && m.scoreA != null && m.scoreB != null
            ? m.userPrediction.scoreA === m.scoreA && m.userPrediction.scoreB === m.scoreB
            : false;
        const colors = isArg
          ? [ARGENTINA_COLORS.celeste, ARGENTINA_COLORS.white, ARGENTINA_COLORS.amarillo]
          : ["#10B981", "#F5B82E", "#FAFAF7"];
        import("canvas-confetti").then(({ default: confetti }) => {
          confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 }, colors });
          setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.7 }, colors }), 250);
          if (isArg && isExact) {
            // Triple burst from sides for Argentina-exact
            setTimeout(() => confetti({ particleCount: 100, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors }), 500);
            setTimeout(() => confetti({ particleCount: 100, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors }), 500);
          }
        }).catch(() => {});
        void import("@/lib/sound-fx").then((mod) => mod.playWinFanfare()).catch(() => {});
        if (isArg && isExact) {
          setArgentinaGoooolFor(m.id);
          setTimeout(() => setArgentinaGoooolFor(null), 2500);
        }
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
    const horizonGeneric = now + 2 * 86_400_000;
    // Defensive: incluso si findNextArgentina devuelve algo, validamos kickoff > now
    // (por si el sync no actualizó el match a LIVE/FINISHED).
    const nextArg = findNextArgentina(apiMatches);
    if (nextArg && new Date(nextArg.matchDateIso).getTime() > now) {
      return { m: nextArg, kickoff: new Date(nextArg.matchDateIso).getTime() };
    }
    const upcoming = apiMatches
      .filter((m) => m.status === "upcoming")
      .map((m) => ({ m, kickoff: new Date(m.matchDateIso).getTime() }))
      .filter((x) => x.kickoff > now)
      .sort((a, b) => a.kickoff - b.kickoff);
    const generic = upcoming.find((x) => x.kickoff < horizonGeneric);
    return generic ?? null;
  }, [apiMatches, liveMatches.length]);

  // "Modo Argentina" para el banner: solo se activa cuando faltan <48h al
  // partido. Antes de eso, el match Argentina aparece igual pero con copy y
  // paleta normales (no queremos celeste/blanco 4 días antes).
  const isArgentinaUpcoming = useMemo(() => {
    if (!nextBigMatch) return false;
    if (!isArgentinaMatch(nextBigMatch.m)) return false;
    const hoursAway = (nextBigMatch.kickoff - Date.now()) / 3_600_000;
    return hoursAway <= 48 && hoursAway > 0;
  }, [nextBigMatch]);

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
      // Statsloaded: data llegó O el dashboard terminó (con o sin error). Eso
      // evita que las cards se queden con "…" infinito si el fetch falla.
      statsLoaded: !!stats || !dashLoading,
    };
  }, [dbUser, stats, dashLoading]);

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

  // Primer match upcoming en tiempo (no en 'sin predecir'). Si ya hay
  // pronóstico, el bloque muestra el score con CTA 'Editar' en vez de
  // 'Predecir ahora'. Antes saltaba al siguiente sin predecir y dejaba al
  // usuario sin saber "lo que viene" si ya había cargado todo el día.
  const now = Date.now();
  const nextMatch = matches.find(
    (m) => m.status === "upcoming" && new Date(m.matchDateIso).getTime() > now,
  );
  // Los siguientes 5 después del nextMatch — alimenta el carrusel "Y después…".
  const upcomingAfter = useMemo(() => {
    if (!nextMatch) return [];
    return matches
      .filter(
        (m) =>
          m.status === "upcoming" &&
          new Date(m.matchDateIso).getTime() > now &&
          m.id !== nextMatch.id,
      )
      .slice(0, 5);
  }, [matches, nextMatch, now]);
  const predictedCount = matches.filter((m) => m.status === "upcoming" && m.userPrediction).length;
  const totalUpcoming = matches.filter((m) => m.status === "upcoming").length;

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
    {/* GOOOOOL full-screen overlay para Argentina + exacto */}
    <AnimatePresence>
      {argentinaGoooolFor && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${ARGENTINA_COLORS.celeste}40 0%, transparent 60%)` }}
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -8 }}
            animate={{ scale: [0.4, 1.2, 1], rotate: [-8, 4, 0] }}
            transition={{ duration: 0.6, ease: "backOut" }}
            className="font-display font-extrabold tracking-tight text-center"
            style={{
              fontSize: "clamp(72px, 18vw, 180px)",
              color: ARGENTINA_COLORS.white,
              textShadow: `0 0 30px ${ARGENTINA_COLORS.celeste}, 0 0 60px ${ARGENTINA_COLORS.celeste}80, 0 6px 20px rgba(0,0,0,0.5)`,
              WebkitTextStroke: `2px ${ARGENTINA_COLORS.celeste}`,
            }}
          >
            ¡GOOOOOL!
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <motion.div
      className="relative space-y-6 pb-6"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Cancha sutil — líneas de campo como bg tenuísimo */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] w-full max-w-2xl opacity-[0.05]"
        viewBox="0 0 600 420"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        aria-hidden="true"
        style={{ color: "#FAFAF7" }}
      >
        {/* Mid line */}
        <line x1="0" y1="210" x2="600" y2="210" />
        {/* Center circle */}
        <circle cx="300" cy="210" r="60" />
        <circle cx="300" cy="210" r="2" fill="currentColor" />
        {/* Top penalty area */}
        <rect x="170" y="0" width="260" height="80" />
        <rect x="240" y="0" width="120" height="30" />
        {/* Bottom penalty area */}
        <rect x="170" y="340" width="260" height="80" />
        <rect x="240" y="390" width="120" height="30" />
        {/* Corner arcs */}
        <path d="M 0 0 A 12 12 0 0 1 12 12" />
        <path d="M 600 0 A 12 12 0 0 0 588 12" />
        <path d="M 0 420 A 12 12 0 0 0 12 408" />
        <path d="M 600 420 A 12 12 0 0 1 588 408" />
      </svg>

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
            className={`w-full rounded-xl py-3.5 font-display text-sm font-bold tracking-widest transition-all active:scale-[0.98] ${
              nextMatch.userPrediction
                ? "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                : "bg-primary text-bg-primary hover:bg-primary/90"
            }`}
            style={
              nextMatch.userPrediction
                ? undefined
                : { boxShadow: "0 0 24px rgba(16,185,129,0.25)" }
            }
          >
            {nextMatch.userPrediction
              ? `Pronóstico: ${nextMatch.userPrediction.scoreA} - ${nextMatch.userPrediction.scoreB} · EDITAR`
              : "PREDECIR AHORA"}
          </button>

          <div className="mt-3 text-center text-xs text-text-muted">
            {predictedCount}/{totalUpcoming} predicciones completadas
          </div>
        </motion.div>
      )}

      {/* Y después… — carrusel horizontal de los próximos partidos */}
      {upcomingAfter.length > 0 && (
        <motion.div variants={fadeUp} className="-mt-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="font-display text-[10px] tracking-widest text-text-muted">Y DESPUÉS</span>
            <button
              onClick={() => setActiveTab("matches")}
              className="text-[10px] text-text-muted hover:text-primary"
            >
              Ver todos
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {upcomingAfter.map((m) => {
              const arDay = new Date(m.matchDateIso).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              const isArg = isArgentinaMatch(m);
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveTab("matches")}
                  className={`shrink-0 snap-start min-w-[150px] rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                    isArg
                      ? "border-[#74ACDF]/40 bg-[#74ACDF]/5 hover:border-[#74ACDF]/60"
                      : "border-border-default bg-bg-surface hover:border-primary/30"
                  }`}
                >
                  <div className="text-[9px] font-display tracking-widest text-text-muted mb-1.5">
                    {arDay} · {m.time}hs
                  </div>
                  <div className="text-sm font-bold flex items-center gap-1 mb-0.5 truncate">
                    <span>{m.teamA.flag}</span>
                    <span className="truncate">{m.teamA.code}</span>
                  </div>
                  <div className="text-sm font-bold flex items-center gap-1 truncate">
                    <span>{m.teamB.flag}</span>
                    <span className="truncate">{m.teamB.code}</span>
                  </div>
                  {m.userPrediction ? (
                    <div className="mt-1.5 text-[10px] text-primary font-bold">
                      {m.userPrediction.scoreA}–{m.userPrediction.scoreB} ✓
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[10px] text-accent">Pendiente</div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Quick Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3 md:gap-4">
        <button
          onClick={() => onNavigate("ranking")}
          className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-br from-bg-surface to-bg-primary p-4 text-center transition-all hover:border-secondary/30 active:scale-[0.97]"
        >
          <div className="absolute top-2 right-2 text-[8px] font-display tracking-widest text-text-muted/40">RANK</div>
          <div
            className="font-display font-black leading-none text-secondary"
            style={{ fontSize: "clamp(40px, 11vw, 56px)", letterSpacing: "-0.02em" }}
          >
            {user.globalRank != null ? user.globalRank : (user.statsLoaded ? "—" : "…")}
          </div>
          <div className="text-[9px] text-text-muted mt-2 font-display tracking-[0.2em]">POSICIÓN</div>
        </button>
        <div className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-br from-bg-surface to-bg-primary p-4 text-center">
          <div className="absolute top-2 right-2 text-[8px] font-display tracking-widest text-text-muted/40">%</div>
          <div
            className="font-display font-black leading-none text-accent"
            style={{ fontSize: "clamp(40px, 11vw, 56px)", letterSpacing: "-0.02em" }}
          >
            {user.precision != null ? user.precision : (user.statsLoaded ? "—" : "…")}
          </div>
          <div className="text-[9px] text-text-muted mt-2 font-display tracking-[0.2em]">PRECISIÓN</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-br from-bg-surface to-bg-primary p-4 text-center">
          <div className="absolute top-2 right-2 text-base">🎯</div>
          <div
            className="font-display font-black leading-none text-text-primary"
            style={{ fontSize: "clamp(40px, 11vw, 56px)", letterSpacing: "-0.02em" }}
          >
            {user.statsLoaded ? user.exactos : "…"}
          </div>
          <div className="text-[9px] text-text-muted mt-2 font-display tracking-[0.2em]">EXACTOS</div>
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
                  JUNTÁ TU GENTE
                </div>
                <div className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto mb-4">
                  Creá tu prode en 30 segundos y pasale el link a tu grupo
                  de WhatsApp. Con 2 personas ya picás.
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-bg-primary font-display text-xs font-bold tracking-widest">
                  <Plus size={14} /> CREAR MI PRODE
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
              {user.streak >= 5 ? `¡VOLÁS! ${user.streak} BOMBAZOS SEGUIDOS` : `¡${user.streak} BOMBAZO${user.streak === 1 ? "" : "S"} SEGUIDO${user.streak === 1 ? "" : "S"}!`}
            </div>
            <div className="text-[11px] text-text-secondary mt-0.5">
              {user.streak >= 5
                ? "Imparable. Levantala que está caliente."
                : user.streak >= 3
                ? "No la cortes. El próximo partido te espera."
                : "Vas con manija. Mantenela con la próxima."}
            </div>
          </div>
        </motion.div>
      )}

      {/* Countdown banner — only shown when no live match is taking the slot.
          When Argentina is the next match, palette switches to celeste/blanco. */}
      {nextBigMatch && countdownLabel && (
        <motion.div variants={fadeUp}>
          <button
            onClick={() => setActiveTab("matches")}
            className={`w-full rounded-2xl p-4 flex items-center gap-4 transition-all active:scale-[0.99] mb-2 text-left border ${
              isArgentinaUpcoming
                ? "border-[#74ACDF]/50 bg-gradient-to-r from-[#74ACDF]/15 via-bg-surface to-white/5 hover:border-[#74ACDF]/70"
                : "border-primary/30 bg-gradient-to-r from-primary/5 via-bg-surface to-primary/5 hover:border-primary/40"
            }`}
            style={isArgentinaUpcoming ? { boxShadow: `0 0 24px ${ARGENTINA_COLORS.celeste}30` } : undefined}
          >
            <CalendarClock size={20} className="shrink-0" style={{ color: isArgentinaUpcoming ? ARGENTINA_COLORS.celeste : undefined }} />
            <div className="flex-1">
              <div
                className="font-display text-[10px] font-bold tracking-widest"
                style={{ color: isArgentinaUpcoming ? ARGENTINA_COLORS.celeste : undefined }}
              >
                {isArgentinaUpcoming ? "ARGENTINA SE VIENE" : "PRÓXIMO PARTIDO"}
              </div>
              <div className="text-sm font-bold mt-0.5">
                {nextBigMatch.m.teamA.flag} {nextBigMatch.m.teamA.code} vs {nextBigMatch.m.teamB.code} {nextBigMatch.m.teamB.flag}
              </div>
              <div className={`text-xs mt-0.5 ${isArgentinaUpcoming ? "text-white/80" : "text-text-muted"}`}>
                {isArgentinaUpcoming ? `${countdownLabel} · cargá tu pronóstico` : countdownLabel}
              </div>
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
              {/* Pelotita pulsando estilo marcador de cancha */}
              <div className="relative shrink-0 flex flex-col items-center gap-1">
                <motion.div
                  className="text-2xl"
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                >
                  ⚽
                </motion.div>
                {lm.minute != null && (
                  <div
                    className="font-display font-black leading-none text-danger"
                    style={{ fontSize: 22, letterSpacing: "-0.05em", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                  >
                    {lm.minute}<span className="text-sm">&apos;</span>
                  </div>
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <motion.span
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    className="inline-block h-2 w-2 rounded-full bg-danger"
                  />
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
