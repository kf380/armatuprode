/**
 * Scoring & XP calculation engine.
 *
 * Scoring: exacto = 3, ganador correcto = 1, fallo = 0
 * XP: predicción = +10, ganador = +20, exacto = +50,
 *     matchday completo = +20, racha 5 = +100
 */

export function calculatePoints(
  predA: number,
  predB: number,
  actualA: number,
  actualB: number,
): number {
  if (predA === actualA && predB === actualB) return 3;

  const predResult = Math.sign(predA - predB);
  const actualResult = Math.sign(actualA - actualB);
  if (predResult === actualResult) return 1;

  return 0;
}

export interface XpReward {
  amount: number;
  reason: string;
}

export function calculateXpForPrediction(points: number): XpReward[] {
  const rewards: XpReward[] = [];

  if (points === 3) {
    rewards.push({ amount: 50, reason: "exact_score" });
  } else if (points === 1) {
    rewards.push({ amount: 20, reason: "correct_winner" });
  }

  return rewards;
}
