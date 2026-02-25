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

export interface PointsBreakdown {
  total: number;
  isExact: boolean;
  isWinner: boolean;
  qualifierCorrect: boolean;
}

export function calculatePointsDetailed(
  predA: number,
  predB: number,
  actualA: number,
  actualB: number,
  phase?: string,
  predictedQualifier?: string | null,
  actualQualifier?: string | null,
): PointsBreakdown {
  const isExact = predA === actualA && predB === actualB;
  const predResult = Math.sign(predA - predB);
  const actualResult = Math.sign(actualA - actualB);
  const isWinner = predResult === actualResult;
  const qualifierCorrect = !!(predictedQualifier && actualQualifier && predictedQualifier === actualQualifier);

  let total = 0;
  if (isKnockout(phase)) {
    if (isExact) total = 5;
    else if (isWinner) total = 2;
    if (qualifierCorrect) total += 3;
  } else {
    if (isExact) total = 3;
    else if (isWinner) total = 1;
  }

  return { total, isExact, isWinner, qualifierCorrect };
}

export function calculateXpForPrediction(points: number, phase?: string, isExact?: boolean, isWinner?: boolean): XpReward[] {
  const rewards: XpReward[] = [];

  if (isExact) {
    rewards.push({ amount: 50, reason: "exact_score" });
  } else if (isWinner) {
    rewards.push({ amount: 20, reason: "correct_winner" });
  } else if (!isExact && !isWinner) {
    // Fallback for legacy calls without breakdown: use point thresholds
    const knockout = isKnockout(phase);
    if (knockout) {
      if (points >= 5) rewards.push({ amount: 50, reason: "exact_score" });
      else if (points === 2) rewards.push({ amount: 20, reason: "correct_winner" });
    } else {
      if (points === 3) rewards.push({ amount: 50, reason: "exact_score" });
      else if (points === 1) rewards.push({ amount: 20, reason: "correct_winner" });
    }
  }

  return rewards;
}
