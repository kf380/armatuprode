/**
 * Fix match #96: Switzerland vs Colombia (ROUND_OF_16)
 * Score stored correctly as 0-0 AET, but qualifiedTeam was set to "COL" by mistake.
 * Switzerland won on penalties → qualifiedTeam should be "SUI".
 *
 * Side effect: match #100 (QF) had COL placed via W96 — needs to be corrected to SUI.
 *
 * Rescore:
 * - All 12 predictions had predictedQualifier="COL" → they got +2 qualifier bonus → remove it.
 * - Nobody predicted SUI → no new qualifier points to award.
 * - XP is unaffected (qualifier bonus doesn't grant XP; correct_winner XP for 1-1 preds stays).
 * - 30 qualifier coins were already credited to all 12 users — not reversed (wallet debit not supported).
 */

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { calculatePointsDetailed } from "../src/lib/scoring";

const MATCH_96_ID = "32112e9d-204e-47d8-8f14-86775b9301b5";
const MATCH_100_ID = "5e06b3ac-f79d-4857-89e1-ddbf8665c316";
const SCORE_A = 0;
const SCORE_B = 0;
const CORRECT_QUALIFIER = "SUI";
const PHASE = "ROUND_OF_16";

async function main() {
  console.log("=== Fix #96: SUI 0-0 COL → qualifiedTeam=SUI ===\n");

  // 1. Fix match #96 qualifiedTeam
  await prisma.match.update({
    where: { id: MATCH_96_ID },
    data: { qualifiedTeam: CORRECT_QUALIFIER },
  });
  console.log("Match #96: qualifiedTeam updated to SUI\n");

  // 2. Fix match #100 (QF): teamB was set to COL via advanceBracket(W96→COL) — correct to SUI
  await prisma.match.update({
    where: { id: MATCH_100_ID },
    data: { teamBCode: "SUI", teamBName: "Switzerland", teamBFlag: "🇨🇭" },
  });
  console.log("Match #100: teamB corrected from Colombia → Switzerland\n");

  // 3. Rescore predictions for match #96
  const predictions = await prisma.prediction.findMany({
    where: { matchId: MATCH_96_ID },
  });
  console.log(`Rescoring ${predictions.length} predictions...\n`);

  for (const pred of predictions) {
    const breakdown = calculatePointsDetailed(
      pred.scoreA,
      pred.scoreB,
      SCORE_A,
      SCORE_B,
      PHASE,
      pred.predictedQualifier,
      CORRECT_QUALIFIER,
    );

    const oldPoints = pred.points;
    const newPoints = breakdown.total;

    await prisma.prediction.update({
      where: { id: pred.id },
      data: { points: newPoints },
    });

    console.log(
      `  ${pred.scoreA}-${pred.scoreB} ${pred.predictedQualifier ?? "?"}: ${oldPoints} → ${newPoints} pts` +
        ` (winner=${breakdown.isWinner}, qualifier=${breakdown.qualifierCorrect})`,
    );
  }

  // 4. Verify final state
  const m96 = await prisma.match.findUnique({
    where: { id: MATCH_96_ID },
    select: { officialMatchNumber: true, teamACode: true, teamBCode: true, scoreA: true, scoreB: true, qualifiedTeam: true },
  });
  const m100 = await prisma.match.findUnique({
    where: { id: MATCH_100_ID },
    select: { officialMatchNumber: true, teamACode: true, teamBCode: true, status: true },
  });

  console.log("\n=== Final state ===");
  console.log(`  #${m96?.officialMatchNumber}: ${m96?.teamACode} ${m96?.scoreA}-${m96?.scoreB} ${m96?.teamBCode} | qualified=${m96?.qualifiedTeam}`);
  console.log(`  #${m100?.officialMatchNumber}: ${m100?.teamACode} vs ${m100?.teamBCode} | status=${m100?.status}`);

  console.log("\n=== Done ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
