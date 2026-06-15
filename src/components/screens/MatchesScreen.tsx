"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, Minus, Plus, X, Sparkles, Loader2, CalendarX, Search } from "lucide-react";
import { useApp } from "@/lib/store";
import { useDashboard, apiToScreenMatch, type ScreenMatch } from "@/lib/hooks";
import { getPredictionContent, getExactResultContent } from "@/lib/share";
import ShareButton from "@/components/ShareButton";
import { calendarDayInTz, classifyMatchDay, formatMatchDayLabel } from "@/lib/format-date";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
} as const;

type DateFilter = "today" | "tomorrow" | "week" | "all";

const FILTER_LABEL: Record<DateFilter, string> = {
  today: "HOY",
  tomorrow: "MAÑANA",
  week: "SEMANA",
  all: "TODOS",
};

const FILTERS: DateFilter[] = ["today", "tomorrow", "week", "all"];

type PhaseFilter = "ALL" | "GROUP_STAGE" | "ROUND_OF_32" | "ROUND_OF_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "THIRD_PLACE" | "FINAL";

const PHASE_LABEL: Record<Exclude<PhaseFilter, "ALL">, string> = {
  GROUP_STAGE: "GRUPOS",
  ROUND_OF_32: "32VOS",
  ROUND_OF_16: "OCTAVOS",
  QUARTER_FINALS: "CUARTOS",
  SEMI_FINALS: "SEMIS",
  THIRD_PLACE: "3ER PUESTO",
  FINAL: "FINAL",
};

// Order phases canonically (group stage first, final last) for display.
const PHASE_ORDER: Array<Exclude<PhaseFilter, "ALL">> = [
  "GROUP_STAGE",
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
];

function matchSearchHit(m: ScreenMatch, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    m.teamA.code.toLowerCase().includes(q) ||
    m.teamA.name.toLowerCase().includes(q) ||
    m.teamB.code.toLowerCase().includes(q) ||
    m.teamB.name.toLowerCase().includes(q)
  );
}

interface Prediction {
  matchId: string;
  scoreA: number;
  scoreB: number;
  predictedQualifier?: string | null;
}

export default function MatchesScreen() {
  const { authFetch } = useApp();
  // Consumimos el cache compartido del dashboard (mismo que HomeScreen y
  // ProfileScreen). Si el user navegó por Home antes, esta pantalla aparece
  // instant sin un nuevo fetch.
  const { data: dash, loading, error, refetch } = useDashboard();
  const matches = useMemo(() => (dash?.matches ?? []).map(apiToScreenMatch), [dash]);
  const tournamentName = dash?.tournament?.name ?? "Mundial 2026";
  const [filter, setFilter] = useState<DateFilter>("today");
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("ALL");
  const [search, setSearch] = useState("");
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [tempScoreA, setTempScoreA] = useState(0);
  const [tempScoreB, setTempScoreB] = useState(0);
  const [tempQualifier, setTempQualifier] = useState<string | null>(null);
  const [savedAnimation, setSavedAnimation] = useState<string | null>(null);
  const [sharePrompt, setSharePrompt] = useState<string | null>(null);
  const [lockedToast, setLockedToast] = useState<string | null>(null);

  // Quick-pick inline: debounced autosave por match. Estado por matchId con
  // 'saving' (POST en curso) y 'saved' (success, fade out).
  type QuickStatus = "idle" | "saving" | "saved";
  const [quickStatus, setQuickStatus] = useState<Record<string, QuickStatus>>({});
  const quickTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const quickSavedTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const submitQuick = async (matchId: string, scoreA: number, scoreB: number) => {
    setQuickStatus((s) => ({ ...s, [matchId]: "saving" }));
    try {
      const res = await authFetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, scoreA, scoreB }),
      });
      if (!res.ok) throw new Error("save failed");
      setQuickStatus((s) => ({ ...s, [matchId]: "saved" }));
      void import("@/lib/sound-fx").then((m) => m.playPickConfirm()).catch(() => {});
      void import("@/lib/haptics").then((h) => h.tapConfirm()).catch(() => {});
      // Fade el "saved" después de 1.6s
      if (quickSavedTimerRef.current[matchId]) clearTimeout(quickSavedTimerRef.current[matchId]);
      quickSavedTimerRef.current[matchId] = setTimeout(() => {
        setQuickStatus((s) => ({ ...s, [matchId]: "idle" }));
      }, 1600);
    } catch {
      setQuickStatus((s) => ({ ...s, [matchId]: "idle" }));
      setLockedToast("No pude guardar el pronóstico. Reintentá en un segundo.");
    }
  };

  const handleQuickChange = (matchId: string, scoreA: number, scoreB: number) => {
    // Optimistic UI: actualizo el state local inmediatamente
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        matchId,
        scoreA,
        scoreB,
        predictedQualifier: prev[matchId]?.predictedQualifier ?? null,
      },
    }));
    // Debounce 800ms: el último click después de 800ms quietos dispara el save
    if (quickTimerRef.current[matchId]) clearTimeout(quickTimerRef.current[matchId]);
    quickTimerRef.current[matchId] = setTimeout(() => {
      submitQuick(matchId, scoreA, scoreB);
    }, 800);
    // Haptic feedback chico en cada +/- para sentir el click en mobile
    void import("@/lib/haptics").then((h) => h.tapLight()).catch(() => {});
  };

  // Cleanup timers on unmount.
  useEffect(() => {
    const timers = quickTimerRef.current;
    const savedTimers = quickSavedTimerRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      Object.values(savedTimers).forEach(clearTimeout);
    };
  }, []);

  // Auto-clear the "match arrancó" toast after 3s.
  useEffect(() => {
    if (!lockedToast) return;
    const t = setTimeout(() => setLockedToast(null), 3000);
    return () => clearTimeout(t);
  }, [lockedToast]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const allUpcoming = useMemo(
    () => matches.filter((m) => m.status === "upcoming"),
    [matches],
  );
  const finishedMatches = matches.filter((m) => m.status === "finished");

  // Bucket counts (for showing how many in each tab + auto-pick fallback).
  const bucketCounts = useMemo(() => {
    const counts = { today: 0, tomorrow: 0, thisWeek: 0, later: 0 };
    for (const m of allUpcoming) {
      const b = classifyMatchDay(m.matchDateIso);
      if (b === "today") counts.today++;
      else if (b === "tomorrow") counts.tomorrow++;
      else if (b === "thisWeek") counts.thisWeek++;
      else if (b === "later") counts.later++;
    }
    return counts;
  }, [allUpcoming]);

  // Phases actually represented in the upcoming pool (so we don't show
  // empty pills for stages that aren't unlocked yet).
  const availablePhases = useMemo(() => {
    const set = new Set<string>();
    for (const m of allUpcoming) set.add(m.phase);
    return PHASE_ORDER.filter((p) => set.has(p));
  }, [allUpcoming]);

  // Apply the date filter. "week" includes today + tomorrow + thisWeek.
  const dateFiltered = useMemo(() => {
    if (filter === "all") return allUpcoming;
    return allUpcoming.filter((m) => {
      const b = classifyMatchDay(m.matchDateIso);
      if (filter === "today") return b === "today";
      if (filter === "tomorrow") return b === "tomorrow";
      if (filter === "week") return b === "today" || b === "tomorrow" || b === "thisWeek";
      return false;
    });
  }, [allUpcoming, filter]);

  // Then apply phase filter (chained).
  const phaseFiltered = useMemo(() => {
    if (phaseFilter === "ALL") return dateFiltered;
    return dateFiltered.filter((m) => m.phase === phaseFilter);
  }, [dateFiltered, phaseFilter]);

  // Then search (chained).
  const upcomingMatches = useMemo(() => {
    return phaseFiltered.filter((m) => matchSearchHit(m, search));
  }, [phaseFiltered, search]);

  // Group by calendar day in browser timezone — rendered as section headers
  // when the active filter spans multiple days. For "today"/"tomorrow" we
  // skip headers (single day, redundant).
  const groupedByDay = useMemo(() => {
    if (filter === "today" || filter === "tomorrow") return null;
    const groups = new Map<string, ScreenMatch[]>();
    for (const m of upcomingMatches) {
      const day = calendarDayInTz(m.matchDateIso);
      const arr = groups.get(day) ?? [];
      arr.push(m);
      groups.set(day, arr);
    }
    // Sort days ascending (chronological).
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingMatches, filter]);

  const totalUpcoming = upcomingMatches.length;
  const predicted = upcomingMatches.filter(
    (m) => m.userPrediction || predictions[m.id],
  ).length;

  const openPredict = (matchId: string) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;
    // Hard gate: same condition as backend (status + matchDate). Prevents the
    // modal from opening on a match that already kicked off, even if backend
    // status hasn't been synced yet.
    const kickedOff = new Date(match.matchDateIso).getTime() <= Date.now();
    if (kickedOff || match.status !== "upcoming") {
      const live = match.status === "live";
      setLockedToast(
        live
          ? "Ya rueda la pelota. Mirá el partido, el pronóstico quedó cerrado."
          : "Llegaste tarde. Este pronóstico ya cerró.",
      );
      return;
    }
    const existing = predictions[matchId];
    setTempScoreA(existing?.scoreA ?? match.userPrediction?.scoreA ?? 0);
    setTempScoreB(existing?.scoreB ?? match.userPrediction?.scoreB ?? 0);
    setTempQualifier(existing?.predictedQualifier ?? match.userPrediction?.predictedQualifier ?? null);
    setEditingMatch(matchId);
  };

  const savePrediction = async () => {
    if (!editingMatch) return;
    const match = matches.find((m) => m.id === editingMatch);

    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: editingMatch,
          scoreA: tempScoreA,
          scoreB: tempScoreB,
          ...(match?.phase !== "GROUP_STAGE" && tempQualifier ? { predictedQualifier: tempQualifier } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || "No pudimos guardar la prediccion. Reintentá.");
        setSaving(false);
        return;
      }
    } catch {
      setSaveError("Error de conexion. Revisá tu internet y reintentá.");
      setSaving(false);
      return;
    }
    setSaving(false);

    setPredictions((prev) => ({
      ...prev,
      [editingMatch]: { matchId: editingMatch, scoreA: tempScoreA, scoreB: tempScoreB, predictedQualifier: tempQualifier },
    }));
    setSavedAnimation(editingMatch);
    setEditingMatch(null);
    void import("@/lib/sound-fx").then((m) => m.playPickConfirm()).catch(() => {});

    // Show share prompt after save
    if (match) {
      setSharePrompt(editingMatch);
      setTimeout(() => {
        if (sharePrompt === editingMatch) setSharePrompt(null);
      }, 5000);
    }

    setTimeout(() => setSavedAnimation(null), 1500);
  };

  if (loading) {
    return (
      <div className="space-y-3 px-1 pt-6">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-2xl border border-border-default bg-gradient-to-r from-bg-surface via-bg-primary/40 to-bg-surface animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <AlertTriangle className="text-danger mb-3" size={32} />
        <h2 className="font-display text-sm font-bold tracking-widest mb-2">
          NO PUDIMOS CARGAR LOS PARTIDOS
        </h2>
        <p className="text-xs text-text-secondary mb-5">
          Revisá tu conexión y reintentá.
        </p>
        <button
          onClick={() => refetch()}
          className="rounded-xl bg-primary px-6 py-3 font-display text-xs font-bold tracking-widest text-bg-primary"
        >
          REINTENTAR
        </button>
      </div>
    );
  }

  return (
    <motion.div className="space-y-5 pb-6" variants={stagger} initial="hidden" animate="show">
      {/* Header */}
      <motion.div variants={fadeUp} className="pt-2">
        <h1 className="font-display text-xl font-bold tracking-widest">PARTIDOS</h1>
        <p className="mt-0.5 text-base text-text-secondary">{tournamentName}</p>
      </motion.div>

      {/* Date filter pills (row 1) */}
      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map((f) => {
          const count =
            f === "today"
              ? bucketCounts.today
              : f === "tomorrow"
                ? bucketCounts.tomorrow
                : f === "week"
                  ? bucketCounts.today + bucketCounts.tomorrow + bucketCounts.thisWeek
                  : allUpcoming.length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 font-display text-xs font-bold tracking-widest transition-all flex items-center gap-2 ${
                filter === f
                  ? "bg-primary text-bg-primary shadow-[0_0_14px_rgba(16,185,129,0.25)]"
                  : "border border-border-default text-text-muted hover:text-text-secondary hover:border-text-muted/30"
              }`}
            >
              {FILTER_LABEL[f]}
              <span
                className={`text-[10px] font-bold rounded-full px-1.5 py-0 ${
                  filter === f
                    ? "bg-bg-primary/20 text-bg-primary"
                    : "bg-bg-primary text-text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Phase filter chips (row 2) — only when more than one phase exists */}
      {availablePhases.length > 1 && (
        <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          <button
            onClick={() => setPhaseFilter("ALL")}
            className={`shrink-0 rounded-full px-3 py-1 font-display text-[10px] font-bold tracking-wider transition-all ${
              phaseFilter === "ALL"
                ? "bg-text-primary text-bg-primary"
                : "border border-border-default text-text-muted"
            }`}
          >
            FASES: TODAS
          </button>
          {availablePhases.map((p) => (
            <button
              key={p}
              onClick={() => setPhaseFilter(p)}
              className={`shrink-0 rounded-full px-3 py-1 font-display text-[10px] font-bold tracking-wider transition-all ${
                phaseFilter === p
                  ? "bg-text-primary text-bg-primary"
                  : "border border-border-default text-text-muted hover:text-text-secondary"
              }`}
            >
              {PHASE_LABEL[p]}
            </button>
          ))}
        </motion.div>
      )}

      {/* Search */}
      <motion.div variants={fadeUp} className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar equipo..."
          className="w-full rounded-xl border border-border-default bg-bg-surface pl-9 pr-9 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary"
            aria-label="Limpiar búsqueda"
          >
            <X size={12} />
          </button>
        )}
      </motion.div>

      {/* Progress bar */}
      <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-text-secondary">Predicciones completadas</span>
          <span className="font-display text-xs font-bold text-primary">
            {predicted}/{totalUpcoming}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-primary">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: 0 }}
            animate={{ width: totalUpcoming > 0 ? `${(predicted / totalUpcoming) * 100}%` : "0%" }}
            transition={{ duration: 0.6 }}
            style={{ boxShadow: "0 0 8px rgba(16,185,129,0.4)" }}
          />
        </div>
        {totalUpcoming > 0 && predicted === totalUpcoming && (
          <div className="mt-1.5 flex items-center gap-1 text-xs text-accent">
            <Sparkles size={12} /> +20 XP bonus por completar todas!
          </div>
        )}
      </motion.div>

      {/* Upcoming Matches */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display text-xs font-bold tracking-widest text-text-muted mb-3">
          PROXIMOS PARTIDOS
        </h2>
        {upcomingMatches.length === 0 && (
          <div className="rounded-xl border border-border-default bg-bg-surface p-8 text-center">
            <CalendarX className="mx-auto text-text-muted mb-2" size={28} />
            <div className="text-sm text-text-primary mb-1">
              {search
                ? `Sin resultados para "${search}"`
                : phaseFilter !== "ALL" && dateFiltered.length === 0
                  ? `No hay partidos en ${PHASE_LABEL[phaseFilter as Exclude<PhaseFilter, "ALL">]}`
                  : filter === "today"
                    ? "No hay partidos hoy"
                    : filter === "tomorrow"
                      ? "No hay partidos mañana"
                      : filter === "week"
                        ? "No hay partidos esta semana"
                        : "No hay próximos partidos"}
            </div>
            <p className="text-xs text-text-muted mb-4">
              {search
                ? "Probá con otro nombre o código."
                : phaseFilter !== "ALL" && dateFiltered.length > 0
                  ? "Hay partidos en otras fases."
                  : filter !== "all" && allUpcoming.length > 0
                    ? `Hay ${allUpcoming.length} partido${allUpcoming.length === 1 ? "" : "s"} más adelante.`
                    : "El torneo no tiene partidos cargados todavía."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="rounded-xl border border-border-default bg-bg-primary px-4 py-2 text-xs font-display font-bold tracking-wider text-text-primary hover:border-primary/40"
                >
                  LIMPIAR BÚSQUEDA
                </button>
              )}
              {!search && phaseFilter !== "ALL" && (
                <button
                  onClick={() => setPhaseFilter("ALL")}
                  className="rounded-xl border border-border-default bg-bg-primary px-4 py-2 text-xs font-display font-bold tracking-wider text-text-primary hover:border-primary/40"
                >
                  TODAS LAS FASES
                </button>
              )}
              {!search && filter !== "all" && allUpcoming.length > 0 && (
                <button
                  onClick={() => setFilter("all")}
                  className="rounded-xl border border-border-default bg-bg-primary px-4 py-2 text-xs font-display font-bold tracking-wider text-text-primary hover:border-primary/40"
                >
                  VER TODOS
                </button>
              )}
            </div>
          </div>
        )}
        {/* Render: grouped by day when filter spans multiple days, flat list otherwise. */}
        {(() => {
          const renderCard = (match: ScreenMatch) => {
            const hasPred = match.userPrediction || predictions[match.id];
            const pred = predictions[match.id] || match.userPrediction;
            const justSaved = savedAnimation === match.id;
            const showSharePrompt = sharePrompt === match.id;

            return (
              <motion.div
                key={match.id}
                variants={fadeUp}
                className={`relative overflow-hidden rounded-xl border p-4 transition-all ${
                  justSaved
                    ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    : hasPred
                    ? "border-primary/20 bg-bg-surface"
                    : "border-accent/30 bg-bg-surface"
                }`}
              >
                {justSaved && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-bg-surface/90 z-10"
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-1">✅</div>
                      <div className="font-display text-sm font-bold text-primary">
                        Prediccion guardada!
                      </div>
                      <div className="text-xs text-accent mt-0.5">+10 XP</div>
                    </div>
                  </motion.div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-display tracking-widest text-text-muted">
                    {match.group} • {formatMatchDayLabel(match.matchDateIso)} • {match.time}hs
                  </span>
                  {hasPred ? (
                    <span className="flex items-center gap-1 text-[10px] text-primary font-bold">
                      <Check size={12} /> Completado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-accent font-bold">
                      <AlertTriangle size={12} /> Pendiente
                    </span>
                  )}
                </div>

                {(() => {
                  const kickedOff = new Date(match.matchDateIso).getTime() <= Date.now();
                  const locked = kickedOff || match.status !== "upcoming";
                  const canQuickPick = !locked && match.phase === "GROUP_STAGE";
                  const currentA = pred?.scoreA ?? 0;
                  const currentB = pred?.scoreB ?? 0;
                  const status = quickStatus[match.id] ?? "idle";

                  if (canQuickPick) {
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          {/* Team A — flag + nombre + +/- */}
                          <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                            <div className="flex flex-col items-center gap-0.5 w-full">
                              <span className="text-2xl leading-none">{match.teamA.flag}</span>
                              <div className="font-display text-[11px] font-bold text-center leading-tight truncate w-full px-1">
                                {match.teamA.name}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleQuickChange(match.id, Math.max(0, currentA - 1), currentB)}
                                className="h-8 w-8 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/40 active:scale-95"
                                aria-label={`Bajar gol ${match.teamA.name}`}
                              >
                                <Minus size={14} />
                              </button>
                              <motion.span
                                key={`A-${match.id}-${currentA}`}
                                initial={{ scale: 1.25, color: "#10B981" }}
                                animate={{ scale: 1, color: "currentColor" }}
                                transition={{ type: "spring", stiffness: 480, damping: 18 }}
                                className="font-display text-2xl font-bold text-primary w-7 text-center inline-block"
                              >
                                {currentA}
                              </motion.span>
                              <button
                                onClick={() => handleQuickChange(match.id, Math.min(15, currentA + 1), currentB)}
                                className="h-8 w-8 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/40 active:scale-95"
                                aria-label={`Subir gol ${match.teamA.name}`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Status + VS center */}
                          <div className="flex flex-col items-center gap-1.5 px-1 shrink-0">
                            <div className="font-display text-[10px] text-text-muted tracking-widest">VS</div>
                            <div className="h-5">
                              {status === "saving" && <Loader2 size={14} className="animate-spin text-text-muted" />}
                              {status === "saved" && <Check size={14} className="text-primary" />}
                            </div>
                          </div>

                          {/* Team B */}
                          <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
                            <div className="flex flex-col items-center gap-0.5 w-full">
                              <span className="text-2xl leading-none">{match.teamB.flag}</span>
                              <div className="font-display text-[11px] font-bold text-center leading-tight truncate w-full px-1">
                                {match.teamB.name}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleQuickChange(match.id, currentA, Math.max(0, currentB - 1))}
                                className="h-8 w-8 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/40 active:scale-95"
                                aria-label={`Bajar gol ${match.teamB.name}`}
                              >
                                <Minus size={14} />
                              </button>
                              <motion.span
                                key={`B-${match.id}-${currentB}`}
                                initial={{ scale: 1.25, color: "#10B981" }}
                                animate={{ scale: 1, color: "currentColor" }}
                                transition={{ type: "spring", stiffness: 480, damping: 18 }}
                                className="font-display text-2xl font-bold text-primary w-7 text-center inline-block"
                              >
                                {currentB}
                              </motion.span>
                              <button
                                onClick={() => handleQuickChange(match.id, currentA, Math.min(15, currentB + 1))}
                                className="h-8 w-8 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/40 active:scale-95"
                                aria-label={`Subir gol ${match.teamB.name}`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  }

                  // Knockout o partido bloqueado → modal completo
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-2xl">{match.teamA.flag}</span>
                          <div>
                            <div className="font-display text-sm font-bold">{match.teamA.code}</div>
                            <div className="text-[10px] text-text-muted">{match.teamA.name}</div>
                          </div>
                        </div>
                        {hasPred && pred ? (
                          <button
                            onClick={() => openPredict(match.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-primary border border-border-default"
                          >
                            <span className="font-display text-lg font-bold text-primary">{pred.scoreA}</span>
                            <span className="text-text-muted text-xs">-</span>
                            <span className="font-display text-lg font-bold text-primary">{pred.scoreB}</span>
                          </button>
                        ) : (
                          <span className="font-display text-sm text-text-muted tracking-widest px-3">VS</span>
                        )}
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <div className="text-right">
                            <div className="font-display text-sm font-bold">{match.teamB.code}</div>
                            <div className="text-[10px] text-text-muted">{match.teamB.name}</div>
                          </div>
                          <span className="text-2xl">{match.teamB.flag}</span>
                        </div>
                      </div>
                      {!hasPred && !locked && (
                        <button
                          onClick={() => openPredict(match.id)}
                          className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 py-2 font-display text-xs font-bold tracking-widest text-primary transition-all hover:bg-primary/20 active:scale-[0.98]"
                        >
                          {match.phase === "GROUP_STAGE" ? "PREDECIR" : "PREDECIR + CLASIFICADO"}
                        </button>
                      )}
                    </>
                  );
                })()}

                {/* Share prompt after saving */}
                {showSharePrompt && hasPred && pred && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 overflow-hidden"
                  >
                    <ShareButton
                      content={getPredictionContent(match, pred.scoreA, pred.scoreB)}
                      label="COMPARTIR PREDICCION"
                      variant="primary"
                    />
                  </motion.div>
                )}
              </motion.div>
            );
          };

          if (groupedByDay && upcomingMatches.length > 0) {
            return (
              <div className="space-y-5">
                {groupedByDay.map(([day, items]) => (
                  <div key={day}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-display text-[10px] font-bold tracking-widest text-text-muted uppercase">
                        {formatMatchDayLabel(items[0].matchDateIso)}
                      </h3>
                      <span className="text-[10px] text-text-muted">·</span>
                      <span className="text-[10px] text-text-muted">
                        {items.length} partido{items.length === 1 ? "" : "s"}
                      </span>
                      <div className="flex-1 h-px bg-border-default ml-2" />
                    </div>
                    <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                      {items.map(renderCard)}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          return (
            <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              {upcomingMatches.map(renderCard)}
            </div>
          );
        })()}
      </motion.div>

      {/* Finished Matches */}
      {finishedMatches.length > 0 && (
        <motion.div variants={fadeUp}>
          <h2 className="font-display text-xs font-bold tracking-widest text-text-muted mb-3">
            FINALIZADOS
          </h2>
          <div className="space-y-2 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {finishedMatches.map((match) => (
              <div
                key={match.id}
                className="rounded-xl border border-border-default bg-bg-surface p-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xl">{match.teamA.flag}</span>
                    <span className="font-display text-xs font-bold">{match.teamA.code}</span>
                  </div>
                  <div className="text-center px-3">
                    <div className="font-display text-lg font-bold">
                      {match.scoreA ?? 0} - {match.scoreB ?? 0}
                    </div>
                    <div className="text-[10px] text-text-muted">Final</div>
                  </div>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="font-display text-xs font-bold">{match.teamB.code}</span>
                    <span className="text-xl">{match.teamB.flag}</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-border-default pt-2">
                  <div className="text-xs text-text-muted">
                    <div>Tu prediccion: {match.userPrediction?.scoreA}-{match.userPrediction?.scoreB}</div>
                    {match.qualifiedTeam && (
                      <div className="mt-0.5">Clasifico: <strong>{match.qualifiedTeam}</strong></div>
                    )}
                  </div>
                  {match.pointsEarned !== undefined && (
                    <span
                      className={`font-display text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        match.pointsEarned >= 5
                          ? "bg-accent/20 text-accent"
                          : match.pointsEarned >= 1
                          ? "bg-primary/20 text-primary"
                          : "bg-danger/20 text-danger"
                      }`}
                    >
                      {match.pointsEarned >= 5 ? `🎯 EXACTO +${match.pointsEarned}` : match.pointsEarned >= 1 ? `✅ +${match.pointsEarned}` : "❌ 0"}
                    </span>
                  )}
                </div>
                {/* Share result button for finished matches with points */}
                {match.pointsEarned !== undefined && match.pointsEarned > 0 && (
                  <div className="mt-2">
                    <ShareButton
                      content={getExactResultContent(match, match.scoreA ?? 0, match.scoreB ?? 0, match.pointsEarned ?? 0)}
                      label="COMPARTIR RESULTADO"
                      variant="outline"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Prediction Modal */}
      <AnimatePresence>
        {editingMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setEditingMatch(null);
              setSaveError(null);
            }}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-t-3xl md:rounded-3xl border-t border-x md:border border-border-default bg-bg-surface px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:p-6 md:max-w-md max-h-[85vh] overflow-y-auto"
            >
              {(() => {
                const match = matches.find((m) => m.id === editingMatch);
                if (!match) return null;
                return (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-display text-sm font-bold tracking-wider">PREDICCION</h3>
                        <p className="text-xs text-text-muted">
                          {match.group} • {formatMatchDayLabel(match.matchDateIso)} • {match.time}hs
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingMatch(null);
                          setSaveError(null);
                        }}
                        className="h-8 w-8 rounded-full border border-border-default flex items-center justify-center text-text-muted hover:text-text-primary"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-4 mb-6">
                      {/* Team A */}
                      <div className="flex-1 text-center">
                        <div className="text-4xl mb-2">{match.teamA.flag}</div>
                        <div className="font-display text-sm font-bold">{match.teamA.name}</div>
                        <div className="mt-4 flex items-center justify-center gap-3">
                          <button
                            onClick={() => setTempScoreA(Math.max(0, tempScoreA - 1))}
                            className="h-10 w-10 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/50 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-display text-4xl font-bold text-primary w-12 text-center">
                            {tempScoreA}
                          </span>
                          <button
                            onClick={() => setTempScoreA(Math.min(15, tempScoreA + 1))}
                            className="h-10 w-10 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/50 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="font-display text-lg text-text-muted">VS</div>

                      {/* Team B */}
                      <div className="flex-1 text-center">
                        <div className="text-4xl mb-2">{match.teamB.flag}</div>
                        <div className="font-display text-sm font-bold">{match.teamB.name}</div>
                        <div className="mt-4 flex items-center justify-center gap-3">
                          <button
                            onClick={() => setTempScoreB(Math.max(0, tempScoreB - 1))}
                            className="h-10 w-10 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/50 transition-colors"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-display text-4xl font-bold text-primary w-12 text-center">
                            {tempScoreB}
                          </span>
                          <button
                            onClick={() => setTempScoreB(Math.min(15, tempScoreB + 1))}
                            className="h-10 w-10 rounded-full border border-border-default bg-bg-primary flex items-center justify-center text-text-secondary hover:border-primary/50 transition-colors"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Knockout qualifier selector */}
                    {match.phase !== "GROUP_STAGE" && (
                      <div className="rounded-xl border border-border-default bg-bg-primary p-3 mb-4">
                        <div className="text-xs text-text-muted mb-2 font-display tracking-wider">QUIEN CLASIFICA?</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setTempQualifier(match.teamA.code)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-display text-xs font-bold transition-all ${
                              tempQualifier === match.teamA.code
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border-default text-text-muted hover:border-text-muted/30"
                            }`}
                          >
                            <span>{match.teamA.flag}</span> {match.teamA.code}
                          </button>
                          <button
                            onClick={() => setTempQualifier(match.teamB.code)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-display text-xs font-bold transition-all ${
                              tempQualifier === match.teamB.code
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border-default text-text-muted hover:border-text-muted/30"
                            }`}
                          >
                            <span>{match.teamB.flag}</span> {match.teamB.code}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border border-border-default bg-bg-primary p-3 mb-4">
                      <div className="text-xs text-text-muted mb-1">Puntos posibles:</div>
                      {match.phase === "GROUP_STAGE" ? (
                        <div className="flex justify-between text-xs">
                          <span>🎯 Resultado exacto: <strong className="text-accent">+3 pts</strong></span>
                          <span>✅ Ganador correcto: <strong className="text-primary">+1 pt</strong></span>
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>🎯 Exacto (90&apos;): <strong className="text-accent">+5 pts</strong></span>
                            <span>✅ Ganador (90&apos;): <strong className="text-primary">+2 pts</strong></span>
                          </div>
                          <div>
                            <span>🏆 Clasificado correcto: <strong className="text-secondary">+3 pts</strong></span>
                          </div>
                        </div>
                      )}
                    </div>

                    {saveError && (
                      <div className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger">
                        {saveError}
                      </div>
                    )}
                    <button
                      onClick={savePrediction}
                      disabled={saving}
                      className="w-full rounded-xl bg-primary py-3.5 font-display text-sm font-bold tracking-widest text-bg-primary transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}
                    >
                      {saving ? (
                        <><Loader2 size={16} className="animate-spin" /> GUARDANDO...</>
                      ) : (
                        <>CONFIRMAR {tempScoreA} - {tempScoreB}</>
                      )}
                    </button>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast: match arrancado / en vivo */}
      <AnimatePresence>
        {lockedToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[70] max-w-[90vw] rounded-full border border-amber-500/40 bg-bg-surface px-4 py-2.5 text-xs text-text-primary shadow-2xl flex items-center gap-2"
          >
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span>{lockedToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
