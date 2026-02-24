/**
 * Scoring & XP calculation engine.
 *
 * Grupos: exacto = 3, ganador correcto = 1, fallo = 0
 * Knockout: exacto = 5, ganador = 2, clasificado correcto = +3 (independiente)
 * XP: predicción = +10, ganador = +20, exacto = +50,
 *     matchday completo = +20, racha 5 = +100
 */

export type TournamentPhase =
  | "GROUP_STAGE"
  | "ROUND_OF_16"
  | "QUARTER_FINALS"
  | "SEMI_FINALS"
  | "FINAL";

function isKnockout(phase?: string): boolean {
  return !!phase && phase !== "GROUP_STAGE";
}

export function calculatePoints(
  predA: number,
  predB: number,
  actualA: number,
  actualB: number,
  phase?: string,
  predictedQualifier?: string | null,
  actualQualifier?: string | null,
): number {
  let points = 0;

  const isExact = predA === actualA && predB === actualB;
  const predResult = Math.sign(predA - predB);
  const actualResult = Math.sign(actualA - actualB);
  const isWinner = predResult === actualResult;

  if (isKnockout(phase)) {
    if (isExact) {
      points = 5;
    } else if (isWinner) {
      points = 2;
    }
    // Qualifier bonus (independent of score prediction)
    if (predictedQualifier && actualQualifier && predictedQualifier === actualQualifier) {
      points += 3;
    }
  } else {
    // Group stage
    if (isExact) return 3;
    if (isWinner) return 1;
    return 0;
  }

  return points;
}

export interface XpReward {
  amount: number;
  reason: string;
}

export function calculateXpForPrediction(points: number, phase?: string): XpReward[] {
  const rewards: XpReward[] = [];
  const knockout = isKnockout(phase);

  // For knockout, base points (without qualifier bonus) determine XP
  // Exact: 5 (knockout) or 3 (groups) → +50 XP
  // Winner: 2 (knockout) or 1 (groups) → +20 XP
  if (knockout) {
    // points could be 5, 8, 2, 5 (with qualifier), 3 (just qualifier), 0
    const basePoints = points >= 5 ? 5 : points >= 2 ? 2 : 0;
    if (basePoints === 5) {
      rewards.push({ amount: 50, reason: "exact_score" });
    } else if (basePoints === 2) {
      rewards.push({ amount: 20, reason: "correct_winner" });
    }
  } else {
    if (points === 3) {
      rewards.push({ amount: 50, reason: "exact_score" });
    } else if (points === 1) {
      rewards.push({ amount: 20, reason: "correct_winner" });
    }
  }

  return rewards;
}
