"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Radio, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useLiveMatches } from "@/lib/hooks";
import { calculatePoints } from "@/lib/scoring";

export default function LiveMatchScreen() {
  const { setScreen, liveMatchId } = useApp();
  const { matches, loading } = useLiveMatches(30000);
  const [selectedGroupIdx, setSelectedGroupIdx] = useState(0);
  const [goalFlash, setGoalFlash] = useState(false);
  const prevScoreRef = useRef<string | null>(null);

  // Pick which match to show
  const match = liveMatchId
    ? matches.find((m) => m.id === liveMatchId) || matches[0]
    : matches[0];

  // Detect score changes for goal flash
  useEffect(() => {
    if (!match) return;
    const key = `${match.scoreA}-${match.scoreB}`;
    if (prevScoreRef.current && prevScoreRef.current !== key) {
      setGoalFlash(true);
      setTimeout(() => setGoalFlash(false), 1500);
    }
    prevScoreRef.current = key;
  }, [match?.scoreA, match?.scoreB, match]);

  if (loading && matches.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-primary items-center justify-center gap-4 px-5">
        <div className="text-4xl">📺</div>
        <p className="text-text-muted text-center">No hay partidos en vivo ahora</p>
        <button
          onClick={() => setScreen("main")}
          className="rounded-xl bg-primary px-6 py-2.5 font-display text-xs font-bold tracking-widest text-bg-primary"
        >
          VOLVER
        </button>
      </div>
    );
  }

  const scoreA = match.scoreA ?? 0;
  const scoreB = match.scoreB ?? 0;
  const groupRanking = match.groupRankings[selectedGroupIdx];

  // Calculate live points for each player
  const playersWithPoints = (groupRanking?.ranking || [])
    .map((player) => {
      if (!player.prediction) return { ...player, points: 0 };
      const [predA, predB] = player.prediction.split("-").map(Number);
      const points = calculatePoints(predA, predB, scoreA, scoreB);
      return { ...player, points };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary mx-auto max-w-lg md:max-w-xl w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-lg border-b border-border-default px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setScreen("main")}
            className="h-9 w-9 rounded-full border border-border-default flex items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <motion.div
              className="h-2.5 w-2.5 rounded-full bg-danger"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="font-display text-xs font-bold tracking-widest text-danger">EN VIVO</span>
          </div>
          <div className="w-9" />
        </div>

        {/* Score */}
        <AnimatePresence>
          {goalFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-accent/10 pointer-events-none rounded-b-xl"
            />
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-3xl">{match.teamAFlag}</span>
            <div>
              <div className="font-display text-sm font-bold">{match.teamACode}</div>
              <div className="text-[10px] text-text-muted">{match.teamAName}</div>
            </div>
          </div>

          <div className="px-6 text-center">
            <motion.div
              key={`${scoreA}-${scoreB}`}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="font-display text-3xl font-bold tracking-wider"
            >
              {scoreA} - {scoreB}
            </motion.div>
            <div className="text-[10px] text-text-muted mt-0.5">{match.matchGroup || match.phase}</div>
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="text-right">
              <div className="font-display text-sm font-bold">{match.teamBCode}</div>
              <div className="text-[10px] text-text-muted">{match.teamBName}</div>
            </div>
            <span className="text-3xl">{match.teamBFlag}</span>
          </div>
        </div>

        {/* User prediction */}
        {match.userPrediction && (
          <div className="mt-3 text-center text-xs text-text-muted">
            Tu prediccion: <span className="font-mono font-bold text-text-secondary">{match.userPrediction.scoreA}-{match.userPrediction.scoreB}</span>
            {" → "}
            <span className={`font-bold ${
              calculatePoints(match.userPrediction.scoreA, match.userPrediction.scoreB, scoreA, scoreB) === 3
                ? "text-accent"
                : calculatePoints(match.userPrediction.scoreA, match.userPrediction.scoreB, scoreA, scoreB) === 1
                  ? "text-primary"
                  : "text-danger"
            }`}>
              +{calculatePoints(match.userPrediction.scoreA, match.userPrediction.scoreB, scoreA, scoreB)} pts
            </span>
          </div>
        )}
      </div>

      {/* Group selector */}
      {match.groupRankings.length > 1 && (
        <div className="flex gap-2 px-5 py-3 overflow-x-auto">
          {match.groupRankings.map((gr, i) => (
            <button
              key={gr.groupId}
              onClick={() => setSelectedGroupIdx(i)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-display font-bold tracking-wider transition-all ${
                i === selectedGroupIdx
                  ? "bg-primary text-bg-primary"
                  : "border border-border-default text-text-muted"
              }`}
            >
              {gr.groupEmoji} {gr.groupName}
            </button>
          ))}
        </div>
      )}

      {/* Live ranking */}
      <div className="flex-1 px-5 py-5">
        {groupRanking && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Radio size={14} className="text-primary" />
              <span className="font-display text-xs font-bold tracking-widest text-text-muted">
                RANKING EN VIVO — {groupRanking.groupName}
              </span>
            </div>

            <div className="space-y-2">
              {playersWithPoints.map((player, i) => {
                const position = i + 1;
                const isExact = player.prediction === `${scoreA}-${scoreB}`;
                const predParts = (player.prediction || "0-0").split("-").map(Number);
                const winnerCorrect =
                  (predParts[0] > predParts[1] && scoreA > scoreB) ||
                  (predParts[0] < predParts[1] && scoreA < scoreB) ||
                  (predParts[0] === predParts[1] && scoreA === scoreB);

                return (
                  <motion.div
                    key={player.userId}
                    layout
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
                      player.isUser
                        ? "border-primary/40 bg-primary/5"
                        : position === 1
                          ? "border-accent/30 bg-accent/5"
                          : "border-border-default bg-bg-surface"
                    }`}
                  >
                    <div className="w-8 text-center">
                      <div className={`font-display text-sm font-bold ${
                        position === 1 ? "text-accent" : "text-text-muted"
                      }`}>
                        {position === 1 ? "👑" : `#${position}`}
                      </div>
                    </div>

                    <span className="text-xl">{player.avatar}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold truncate ${player.isUser ? "text-primary" : ""}`}>
                          {player.name}
                        </span>
                        {player.isUser && (
                          <span className="text-[8px] font-display tracking-wider text-primary/70 border border-primary/30 rounded px-1 shrink-0">
                            VOS
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted">
                        Pred: <span className="font-mono font-bold text-text-secondary">{player.prediction}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-display text-sm font-bold px-2.5 py-1 rounded-full ${
                          isExact
                            ? "bg-accent/15 text-accent"
                            : winnerCorrect
                              ? "bg-primary/15 text-primary"
                              : "bg-border-default text-text-muted"
                        }`}
                      >
                        {isExact ? "🎯 +3" : winnerCorrect ? "✅ +1" : "❌ 0"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {!groupRanking && match.groupRankings.length === 0 && (
          <div className="text-center py-8 text-text-muted text-sm">
            Unite a un grupo para ver el ranking en vivo
          </div>
        )}
      </div>

      {/* Goal flash notification */}
      <AnimatePresence>
        {goalFlash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            className="fixed inset-x-5 bottom-24 rounded-2xl bg-accent/95 p-5 text-center shadow-2xl z-50"
          >
            <div className="text-3xl mb-1">⚽</div>
            <div className="font-display text-xl font-bold text-bg-primary tracking-wider">
              GOOOOL!
            </div>
            <div className="text-sm text-bg-primary/80 mt-1">
              {match.teamAName} {scoreA} - {scoreB} {match.teamBName}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
