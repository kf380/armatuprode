"use client";

import type { ScreenMatch } from "@/lib/hooks";

const BRACKET_PHASES = [
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER_FINALS",
  "SEMI_FINALS",
  "THIRD_PLACE",
  "FINAL",
] as const;

const PHASE_LABEL: Record<string, string> = {
  ROUND_OF_32: "32VOS",
  ROUND_OF_16: "OCTAVOS",
  QUARTER_FINALS: "CUARTOS",
  SEMI_FINALS: "SEMIS",
  THIRD_PLACE: "3° PUESTO",
  FINAL: "FINAL",
};

function BracketMatch({ match }: { match: ScreenMatch }) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const sA = match.scoreA ?? null;
  const sB = match.scoreB ?? null;

  const goalsWinA = isFinished && sA !== null && sB !== null && sA > sB;
  const goalsWinB = isFinished && sA !== null && sB !== null && sB > sA;
  const winA = goalsWinA || (!goalsWinA && !goalsWinB && match.qualifiedTeam === match.teamA.code);
  const winB = goalsWinB || (!goalsWinA && !goalsWinB && match.qualifiedTeam === match.teamB.code);

  return (
    <div
      className={`rounded-xl border bg-bg-surface p-2.5 w-[120px] shrink-0 ${
        isLive
          ? "border-accent/50 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
          : "border-border-default"
      }`}
    >
      {isLive && (
        <div className="font-display text-[8px] font-bold tracking-widest text-accent text-center mb-1">
          ● EN VIVO
        </div>
      )}
      <div
        className={`flex items-center gap-1 py-0.5 ${
          isFinished && winB ? "opacity-40" : ""
        }`}
      >
        <span className="text-sm leading-none w-5 text-center">{match.teamA.flag}</span>
        <span className={`font-display text-[10px] font-bold flex-1 truncate ${winA ? "text-primary" : ""}`}>
          {match.teamA.code}
        </span>
        {(isFinished || isLive) && (
          <span className={`font-display text-sm font-bold tabular-nums ml-0.5 ${winA ? "text-primary" : "text-text-muted"}`}>
            {sA ?? "?"}
          </span>
        )}
      </div>
      <div className="border-t border-border-default/40 my-0.5" />
      <div
        className={`flex items-center gap-1 py-0.5 ${
          isFinished && winA ? "opacity-40" : ""
        }`}
      >
        <span className="text-sm leading-none w-5 text-center">{match.teamB.flag}</span>
        <span className={`font-display text-[10px] font-bold flex-1 truncate ${winB ? "text-primary" : ""}`}>
          {match.teamB.code}
        </span>
        {(isFinished || isLive) && (
          <span className={`font-display text-sm font-bold tabular-nums ml-0.5 ${winB ? "text-primary" : "text-text-muted"}`}>
            {sB ?? "?"}
          </span>
        )}
      </div>
      {match.userPrediction && (
        <div className="mt-1 pt-1 border-t border-border-default/30 text-center">
          <span className="font-display text-[8px] text-text-muted tracking-wider">
            {match.userPrediction.scoreA}-{match.userPrediction.scoreB}
            {match.userPrediction.predictedQualifier && ` · ${match.userPrediction.predictedQualifier}`}
          </span>
          {match.pointsEarned !== undefined && (
            <span className={`ml-1 font-display text-[8px] font-bold ${match.pointsEarned > 0 ? "text-primary" : "text-text-muted"}`}>
              +{match.pointsEarned}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function BracketView({ matches }: { matches: ScreenMatch[] }) {
  const knockout = matches.filter((m) => m.phase !== "GROUP_STAGE");

  const byPhase: Record<string, ScreenMatch[]> = {};
  for (const m of knockout) {
    (byPhase[m.phase] ??= []).push(m);
  }

  const activePhases = BRACKET_PHASES.filter((p) => byPhase[p]?.length);

  if (!activePhases.length) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-surface p-10 text-center">
        <div className="text-4xl mb-3">🏆</div>
        <p className="text-sm text-text-muted">
          El bracket aparecerá cuando empiecen los octavos.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1 pb-3">
      <div className="flex items-start gap-3 min-w-max">
        {activePhases.map((phase) => (
          <div key={phase} className="flex flex-col gap-1.5">
            <div className="font-display text-[9px] font-bold tracking-widest text-text-muted text-center px-1 mb-1">
              {PHASE_LABEL[phase] ?? phase}
            </div>
            <div className="flex flex-col gap-2">
              {(byPhase[phase] ?? []).map((m) => (
                <BracketMatch key={m.id} match={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
