/**
 * "Argentina mode" — detección + UX toggles para cuando hay un partido de
 * Argentina cerca. Idea: identidad verde habitual, pero cuando juega la
 * selección, el clima de la app cambia a celeste/blanco. Sutil pero potente.
 */

const ARG_PATTERN = /argentina/i;
const NEAR_HOURS = 24;

export type MatchLike = {
  matchDateIso: string;
  teamA: { name: string };
  teamB: { name: string };
  status: "upcoming" | "live" | "finished";
};

export function isArgentinaMatch<T extends MatchLike>(m: T): boolean {
  return ARG_PATTERN.test(m.teamA.name) || ARG_PATTERN.test(m.teamB.name);
}

/**
 * Returns the next Argentina match within NEAR_HOURS if any, or null.
 * "Near" means kickoff in the next 24 hours OR currently live.
 */
export function findArgentinaNear<T extends MatchLike>(matches: T[]): T | null {
  const now = Date.now();
  const horizon = now + NEAR_HOURS * 3_600_000;
  return (
    matches
      .filter(isArgentinaMatch)
      .filter((m) => {
        const t = new Date(m.matchDateIso).getTime();
        if (m.status === "live") return true;
        if (m.status === "upcoming" && t <= horizon && t >= now) return true;
        return false;
      })
      .sort((a, b) => new Date(a.matchDateIso).getTime() - new Date(b.matchDateIso).getTime())[0] ?? null
  );
}

/**
 * Returns the next upcoming Argentina match (any time horizon), or null.
 * Used for "modo Argentina" subtle highlights without time gate.
 */
export function findNextArgentina<T extends MatchLike>(matches: T[]): T | null {
  const now = Date.now();
  return (
    matches
      .filter(isArgentinaMatch)
      .filter((m) => m.status === "upcoming" && new Date(m.matchDateIso).getTime() > now)
      .sort((a, b) => new Date(a.matchDateIso).getTime() - new Date(b.matchDateIso).getTime())[0] ?? null
  );
}

export const ARGENTINA_COLORS = {
  celeste: "#74ACDF",
  white: "#FFFFFF",
  amarillo: "#F6B40E",
};
