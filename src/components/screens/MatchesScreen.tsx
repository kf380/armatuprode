"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, Minus, Plus, X, Sparkles, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useMatches, ScreenMatch } from "@/lib/hooks";
import { sharePrediction, shareExactResult } from "@/lib/share";
import ShareButton from "@/components/ShareButton";
import { matches as mockMatches } from "@/lib/mock-data";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
} as const;

type DateFilter = "today" | "tomorrow" | "week";

interface Prediction {
  matchId: string;
  scoreA: number;
  scoreB: number;
  predictedQualifier?: string | null;
}

export default function MatchesScreen() {
  const { authFetch } = useApp();
  const { matches: apiMatches, tournamentName, loading, error } = useMatches();
  const [filter, setFilter] = useState<DateFilter>("today");
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [tempScoreA, setTempScoreA] = useState(0);
  const [tempScoreB, setTempScoreB] = useState(0);
  const [tempQualifier, setTempQualifier] = useState<string | null>(null);
  const [savedAnimation, setSavedAnimation] = useState<string | null>(null);
  const [sharePrompt, setSharePrompt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Use API data, fallback to mock if error
  const matches: ScreenMatch[] = useMemo(() => {
    if (error || (apiMatches.length === 0 && !loading)) {
      return mockMatches.map((m) => ({
        ...m,
        phase: "GROUP_STAGE",
        qualifiedTeam: null,
        userPrediction: m.userPrediction ? { ...m.userPrediction, predictedQualifier: null } : null,
      }));
    }
    return apiMatches;
  }, [apiMatches, loading, error]);

  const upcomingMatches = matches.filter((m) => m.status === "upcoming");
  const finishedMatches = matches.filter((m) => m.status === "finished");

  const totalUpcoming = upcomingMatches.length;
  const predicted =
    upcomingMatches.filter((m) => m.userPrediction || predictions[m.id]).length;

  const openPredict = (matchId: string) => {
    const existing = predictions[matchId];
    const match = matches.find((m) => m.id === matchId);
    setTempScoreA(existing?.scoreA ?? match?.userPrediction?.scoreA ?? 0);
    setTempScoreB(existing?.scoreB ?? match?.userPrediction?.scoreB ?? 0);
    setTempQualifier(existing?.predictedQualifier ?? match?.userPrediction?.predictedQualifier ?? null);
    setEditingMatch(matchId);
  };

  const savePrediction = async () => {
    if (!editingMatch) return;
    const match = matches.find((m) => m.id === editingMatch);

    setSaving(true);
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
        const data = await res.json();
        alert(data.error || "Error al guardar prediccion");
        setSaving(false);
        return;
      }
    } catch {
      // Offline fallback: save locally
    }
    setSaving(false);

    setPredictions((prev) => ({
      ...prev,
      [editingMatch]: { matchId: editingMatch, scoreA: tempScoreA, scoreB: tempScoreB, predictedQualifier: tempQualifier },
    }));
    setSavedAnimation(editingMatch);
    setEditingMatch(null);

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
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

      {/* Filter pills */}
      <motion.div variants={fadeUp} className="flex gap-2.5">
        {(["today", "tomorrow", "week"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-5 py-2 font-display text-xs font-bold tracking-widest transition-all ${
              filter === f
                ? "bg-primary text-bg-primary shadow-[0_0_14px_rgba(16,185,129,0.25)]"
                : "border border-border-default text-text-muted hover:text-text-secondary hover:border-text-muted/30"
            }`}
          >
            {f === "today" ? "HOY" : f === "tomorrow" ? "MAÑANA" : "SEMANA"}
          </button>
        ))}
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
        <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {upcomingMatches.map((match) => {
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
                    {match.group} • {match.time}hs
                  </span>
                  {hasPred ? (
                    <span className="flex items-center gap-1 text-[10px] text-primary font-bold">
                      <Check size={12} /> Predicho
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-accent font-bold">
                      <AlertTriangle size={12} /> Pendiente
                    </span>
                  )}
                </div>

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
                      <span className="font-display text-lg font-bold text-primary">
                        {pred.scoreA}
                      </span>
                      <span className="text-text-muted text-xs">-</span>
                      <span className="font-display text-lg font-bold text-primary">
                        {pred.scoreB}
                      </span>
                    </button>
                  ) : (
                    <span className="font-display text-sm text-text-muted tracking-widest px-3">
                      VS
                    </span>
                  )}

                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <div className="text-right">
                      <div className="font-display text-sm font-bold">{match.teamB.code}</div>
                      <div className="text-[10px] text-text-muted">{match.teamB.name}</div>
                    </div>
                    <span className="text-2xl">{match.teamB.flag}</span>
                  </div>
                </div>

                {!hasPred && (
                  <button
                    onClick={() => openPredict(match.id)}
                    className="mt-3 w-full rounded-lg border border-primary/30 bg-primary/10 py-2 font-display text-xs font-bold tracking-widest text-primary transition-all hover:bg-primary/20 active:scale-[0.98]"
                  >
                    PREDECIR
                  </button>
                )}

                {/* Share prompt after saving */}
                {showSharePrompt && hasPred && pred && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 overflow-hidden"
                  >
                    <ShareButton
                      onShare={() => sharePrediction(match, pred.scoreA, pred.scoreB)}
                      label="COMPARTIR PREDICCION"
                      variant="primary"
                    />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
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
                      onShare={() => shareExactResult(match, match.scoreA ?? 0, match.scoreB ?? 0, match.pointsEarned ?? 0)}
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
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setEditingMatch(null)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl md:rounded-3xl border-t border-x md:border border-border-default bg-bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-6 md:max-w-md max-h-[90vh] overflow-y-auto"
            >
              {(() => {
                const match = matches.find((m) => m.id === editingMatch);
                if (!match) return null;
                return (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-display text-sm font-bold tracking-wider">PREDICCION</h3>
                        <p className="text-xs text-text-muted">{match.group} • {match.time}hs</p>
                      </div>
                      <button
                        onClick={() => setEditingMatch(null)}
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
    </motion.div>
  );
}
