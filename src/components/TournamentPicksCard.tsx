"use client";

import { useState, useMemo } from "react";
import { Trophy, ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import { useTournamentPicks } from "@/lib/hooks";

interface Team {
  code: string;
  name: string;
  flag: string;
}

interface Props {
  teams: Team[];
}

export default function TournamentPicksCard({ teams }: Props) {
  const { data, loading, saving, savePick } = useTournamentPicks();
  const [expanded, setExpanded] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [topScorerInput, setTopScorerInput] = useState("");
  const [topScorerFocus, setTopScorerFocus] = useState(false);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.code.localeCompare(b.code)),
    [teams],
  );

  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    if (!q) return sortedTeams;
    return sortedTeams.filter(
      (t) => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [sortedTeams, teamSearch]);

  const currentChampion = data?.pick?.champion ?? null;
  const currentTopScorer = data?.pick?.topScorer ?? null;
  const tally = data?.championTally ?? [];
  const maxTally = tally[0]?.count ?? 1;

  const championTeam = teams.find((t) => t.code === currentChampion);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-surface p-4 flex items-center gap-2">
        <Trophy size={14} className="text-accent" />
        <span className="text-xs text-text-muted">Cargando picks del torneo...</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/5 to-bg-surface overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <Trophy size={16} className="text-accent shrink-0" />
        <div className="flex-1 text-left">
          <div className="font-display text-xs font-bold tracking-widest text-accent">PICKS DEL MUNDIAL</div>
          {currentChampion || currentTopScorer ? (
            <div className="text-[11px] text-text-secondary mt-0.5">
              {championTeam ? `${championTeam.flag} ${championTeam.code}` : "—"}
              {currentTopScorer && ` · ⚽ ${currentTopScorer}`}
            </div>
          ) : (
            <div className="text-[11px] text-text-muted mt-0.5">¿Quién va a ganar el Mundial?</div>
          )}
        </div>
        {saving ? (
          <Loader2 size={14} className="animate-spin text-text-muted" />
        ) : expanded ? (
          <ChevronUp size={16} className="text-text-muted" />
        ) : (
          <ChevronDown size={16} className="text-text-muted" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-accent/20 pt-3">
          {/* Champion selector */}
          <div>
            <div className="text-[10px] font-display font-bold tracking-widest text-text-muted mb-2">CAMPEÓN</div>
            {!showTeamPicker ? (
              <button
                onClick={() => { setShowTeamPicker(true); setTeamSearch(""); }}
                className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  currentChampion
                    ? "border-accent/40 bg-accent/5"
                    : "border-border-default bg-bg-primary hover:border-accent/30"
                }`}
              >
                {championTeam ? (
                  <>
                    <span className="text-2xl">{championTeam.flag}</span>
                    <span className="font-display text-sm font-bold">{championTeam.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-text-muted">Seleccionar equipo...</span>
                )}
              </button>
            ) : (
              <div className="rounded-xl border border-border-default bg-bg-primary overflow-hidden">
                <div className="p-2 border-b border-border-default flex items-center gap-2">
                  <Search size={12} className="text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    placeholder="Buscar equipo..."
                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-text-muted"
                    autoFocus
                  />
                  <button onClick={() => setShowTeamPicker(false)} className="text-text-muted text-xs">✕</button>
                </div>
                <div className="max-h-44 overflow-y-auto grid grid-cols-2 gap-0.5 p-1">
                  {filteredTeams.map((t) => (
                    <button
                      key={t.code}
                      onClick={async () => {
                        setShowTeamPicker(false);
                        await savePick({ champion: t.code });
                      }}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
                        currentChampion === t.code
                          ? "bg-accent/10 text-accent"
                          : "hover:bg-bg-surface text-text-secondary"
                      }`}
                    >
                      <span className="text-base leading-none">{t.flag}</span>
                      <span className="font-display text-[10px] font-bold">{t.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top scorer */}
          <div>
            <div className="text-[10px] font-display font-bold tracking-widest text-text-muted mb-2">GOLEADOR</div>
            <div className="relative">
              <input
                type="text"
                value={topScorerFocus ? topScorerInput : (currentTopScorer ?? "")}
                onFocus={() => {
                  setTopScorerInput(currentTopScorer ?? "");
                  setTopScorerFocus(true);
                }}
                onChange={(e) => setTopScorerInput(e.target.value)}
                onBlur={async () => {
                  setTopScorerFocus(false);
                  const val = topScorerInput.trim();
                  if (val !== (currentTopScorer ?? "")) {
                    await savePick({ topScorer: val || null });
                  }
                }}
                placeholder="Nombre del jugador..."
                className="w-full rounded-xl border border-border-default bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Champion tally */}
          {tally.length > 0 && (
            <div>
              <div className="text-[10px] font-display font-bold tracking-widest text-text-muted mb-2">
                TOP CAMPEON ELEGIDO
              </div>
              <div className="space-y-1.5">
                {tally.slice(0, 5).map((t) => {
                  const team = teams.find((tm) => tm.code === t.code);
                  const pct = Math.round((t.count / maxTally) * 100);
                  return (
                    <div key={t.code} className="flex items-center gap-2">
                      <span className="text-sm w-6 text-center">{team?.flag ?? "🏳"}</span>
                      <span className="font-display text-[10px] font-bold w-8">{t.code}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-bg-primary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent/60"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted w-6 text-right">{t.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
