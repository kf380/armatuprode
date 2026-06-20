"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useRanking } from "@/lib/hooks";
import { getRankingContent } from "@/lib/share";
import ShareButton from "@/components/ShareButton";

type PhaseFilter = "all" | "GROUP_STAGE" | "ROUND_OF_32" | "ROUND_OF_16" | "QUARTER_FINALS" | "SEMI_FINALS" | "FINAL";

const PHASE_LABELS: Record<PhaseFilter, string> = {
  all: "TOTAL",
  GROUP_STAGE: "GRUPOS",
  ROUND_OF_32: "32VOS",
  ROUND_OF_16: "OCTAVOS",
  QUARTER_FINALS: "CUARTOS",
  SEMI_FINALS: "SEMIS",
  FINAL: "FINAL",
};

const PHASES: PhaseFilter[] = ["all", "GROUP_STAGE", "ROUND_OF_32", "ROUND_OF_16", "QUARTER_FINALS", "SEMI_FINALS", "FINAL"];

export default function RankingScreen() {
  const { dbUser } = useApp();
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all");
  const { ranking: apiRanking, userPosition, totalPlayers, loading, error, refetch } = useRanking(
    phaseFilter === "all" ? null : phaseFilter,
  );

  const user = useMemo(() => {
    if (userPosition) return userPosition;
    if (dbUser) {
      return { position: 0, userId: dbUser.id, name: dbUser.name, avatar: dbUser.avatar, country: dbUser.country, points: 0, level: 1 };
    }
    return { position: 0, userId: "", name: "Jugador", avatar: "👤", country: "🌍", points: 0, level: 1 };
  }, [userPosition, dbUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5 pb-6">
        <div className="pt-2"><h1 className="font-display text-xl font-bold tracking-widest">RANKING</h1></div>
        <div className="text-center py-20">
          <p className="text-text-secondary mb-4">No se pudo cargar el ranking</p>
          <button onClick={refetch} className="text-primary text-sm font-semibold font-display tracking-wider">REINTENTAR</button>
        </div>
      </div>
    );
  }

  const top3 = apiRanking.slice(0, 3);
  const rest = apiRanking.slice(3);

  return (
    <div className="space-y-5 pb-6">
      <div className="pt-2">
        <h1 className="font-display text-xl font-bold tracking-widest">RANKING</h1>
        <p className="mt-0.5 text-base text-text-secondary">{totalPlayers > 0 ? totalPlayers.toLocaleString() : "0"} jugadores</p>
      </div>

      {/* Phase filter */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhaseFilter(p)}
            className={`shrink-0 rounded-full px-3 py-1.5 font-display text-[10px] font-bold tracking-wider transition-all ${
              phaseFilter === p
                ? "bg-primary text-bg-primary shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                : "border border-border-default text-text-muted hover:text-text-secondary"
            }`}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {apiRanking.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-text-muted text-sm">Todavia no hay datos para esta fase.</p>
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length >= 3 && (
            <div className="flex items-end justify-center gap-3 md:gap-6 py-4">
              <div className="flex flex-col items-center">
                <div className="text-2xl mb-1">{top3[1].avatar}</div>
                <div className="text-xs font-semibold truncate max-w-[80px]">{top3[1].name}</div>
                <div className="text-[10px] text-text-muted">{top3[1].country}</div>
                <div className="mt-2 w-20 rounded-t-xl bg-gradient-to-t from-secondary/20 to-secondary/5 border border-secondary/30 border-b-0 pt-6 pb-2 text-center">
                  <div className="text-xl">🥈</div>
                  <div className="font-display text-sm font-bold text-secondary">{top3[1].points}</div>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-3xl mb-1 animate-float">{top3[0].avatar}</div>
                <div className="text-xs font-semibold truncate max-w-[80px]">{top3[0].name}</div>
                <div className="text-[10px] text-text-muted">{top3[0].country}</div>
                <div className="mt-2 w-24 rounded-t-xl bg-gradient-to-t from-accent/20 to-accent/5 border border-accent/30 border-b-0 pt-10 pb-2 text-center" style={{ boxShadow: "0 0 20px rgba(245,158,11,0.15)" }}>
                  <div className="text-2xl">👑</div>
                  <div className="font-display text-lg font-bold text-accent">{top3[0].points}</div>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="text-2xl mb-1">{top3[2].avatar}</div>
                <div className="text-xs font-semibold truncate max-w-[80px]">{top3[2].name}</div>
                <div className="text-[10px] text-text-muted">{top3[2].country}</div>
                <div className="mt-2 w-20 rounded-t-xl bg-gradient-to-t from-amber-700/20 to-amber-700/5 border border-amber-700/30 border-b-0 pt-4 pb-2 text-center">
                  <div className="text-xl">🥉</div>
                  <div className="font-display text-sm font-bold text-amber-600">{top3[2].points}</div>
                </div>
              </div>
            </div>
          )}

          {/* Rest of ranking */}
          <div className="space-y-1.5">
            {rest.map((player) => (
              <div key={player.position} className="flex items-center gap-3 rounded-xl border border-border-default bg-bg-surface p-3">
                <span className="w-7 text-center font-display text-sm font-bold text-text-muted">#{player.position}</span>
                <span className="text-xl">{player.avatar}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{player.name}</div>
                  <div className="text-[10px] text-text-muted flex items-center gap-1">
                    {player.country} <span>Nv.{player.level}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-base font-bold">{player.points}</div>
                  <div className="text-[10px] text-text-muted">pts</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Current user position */}
      <div>
        <div className="text-xs font-display tracking-widest text-text-muted mb-2 text-center">— TU POSICION —</div>
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <span className="font-display text-sm font-bold text-primary">#{user.position.toLocaleString()}</span>
          <span className="text-xl">{user.avatar}</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-primary">{user.name}</div>
            <div className="text-[10px] text-text-muted">{user.country} Nv.{user.level}</div>
          </div>
          <div className="text-right mr-2">
            <div className="font-display text-xl font-bold text-primary">{user.points}</div>
            <div className="text-[10px] text-text-muted">pts</div>
          </div>
          <ShareButton content={getRankingContent(user.name, user.position)} variant="icon" />
        </div>
      </div>
    </div>
  );
}
