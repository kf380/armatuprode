import "dotenv/config";
import { PrismaClient, MatchStatus, TournamentPhase } from "@prisma/client";
import { TOURNAMENT, TEAMS, MATCHES } from "../src/data/worldcup-2026";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL },
  },
});

const STAGE_TO_PHASE: Record<string, TournamentPhase> = {
  GROUP_STAGE: TournamentPhase.GROUP_STAGE,
  ROUND_OF_32: TournamentPhase.ROUND_OF_32,
  ROUND_OF_16: TournamentPhase.ROUND_OF_16,
  QUARTER_FINALS: TournamentPhase.QUARTER_FINALS,
  SEMI_FINALS: TournamentPhase.SEMI_FINALS,
  THIRD_PLACE: TournamentPhase.THIRD_PLACE,
  FINAL: TournamentPhase.FINAL,
};

async function main() {
  console.log(`[seed] Mundial 2026 → upserting tournament ${TOURNAMENT.slug}`);

  // 1. Tournament: idempotent upsert by slug.
  const tournament = await prisma.tournament.upsert({
    where: { slug: TOURNAMENT.slug },
    update: {
      name: TOURNAMENT.name,
      year: TOURNAMENT.year,
      hostCountries: [...TOURNAMENT.hostCountries],
      type: "WORLD_CUP",
      startDate: new Date(TOURNAMENT.startDateUtc),
      endDate: new Date(TOURNAMENT.endDateUtc),
      active: true,
    },
    create: {
      slug: TOURNAMENT.slug,
      name: TOURNAMENT.name,
      year: TOURNAMENT.year,
      hostCountries: [...TOURNAMENT.hostCountries],
      type: "WORLD_CUP",
      startDate: new Date(TOURNAMENT.startDateUtc),
      endDate: new Date(TOURNAMENT.endDateUtc),
      active: true,
    },
  });

  // 2. Teams: 48 entries, idempotent upsert by (tournamentId, code).
  // First, remove orphan teams whose codes are no longer in the data file
  // (e.g. placeholder TBD-* teams replaced by real qualifiers after the draw).
  const validCodes = TEAMS.map((t) => t.code);
  const orphans = await prisma.team.deleteMany({
    where: {
      tournamentId: tournament.id,
      code: { notIn: validCodes },
    },
  });
  let teamsCreated = 0;
  let teamsUpdated = 0;
  for (const t of TEAMS) {
    const existing = await prisma.team.findUnique({
      where: { tournamentId_code: { tournamentId: tournament.id, code: t.code } },
    });
    if (existing) {
      await prisma.team.update({
        where: { id: existing.id },
        data: {
          name: t.name,
          country: t.country,
          flag: t.flag,
          confederation: t.confederation,
          groupCode: t.groupCode,
          groupSlot: t.groupSlot,
          isPlaceholder: t.isPlaceholder,
        },
      });
      teamsUpdated++;
    } else {
      await prisma.team.create({
        data: {
          tournamentId: tournament.id,
          code: t.code,
          name: t.name,
          country: t.country,
          flag: t.flag,
          confederation: t.confederation,
          groupCode: t.groupCode,
          groupSlot: t.groupSlot,
          isPlaceholder: t.isPlaceholder,
        },
      });
      teamsCreated++;
    }
  }

  // 3. Matches: 104 entries, keyed by (tournamentId, officialMatchNumber).
  // - LIVE / FINISHED matches are NEVER overwritten (preserves real results).
  // - UPCOMING matches: refresh teams/date/venue/source so admin can re-seed
  //   after fixing fixture data without losing predictions.
  let matchesCreated = 0;
  let matchesUpdated = 0;
  let matchesPreserved = 0;
  for (const m of MATCHES) {
    const existing = await prisma.match.findUnique({
      where: {
        tournamentId_officialMatchNumber: {
          tournamentId: tournament.id,
          officialMatchNumber: m.officialMatchNumber,
        },
      },
    });
    if (existing) {
      if (existing.status === MatchStatus.LIVE || existing.status === MatchStatus.FINISHED) {
        matchesPreserved++;
        continue;
      }
      await prisma.match.update({
        where: { id: existing.id },
        data: {
          teamACode: m.teamACode,
          teamAName: m.teamAName,
          teamAFlag: m.teamAFlag,
          teamBCode: m.teamBCode,
          teamBName: m.teamBName,
          teamBFlag: m.teamBFlag,
          matchDate: new Date(m.matchDateUtc),
          matchGroup: m.group,
          phase: STAGE_TO_PHASE[m.stage],
          venue: m.venue,
          city: m.city,
          country: m.country,
          source: m.source,
        },
      });
      matchesUpdated++;
    } else {
      await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          officialMatchNumber: m.officialMatchNumber,
          teamACode: m.teamACode,
          teamAName: m.teamAName,
          teamAFlag: m.teamAFlag,
          teamBCode: m.teamBCode,
          teamBName: m.teamBName,
          teamBFlag: m.teamBFlag,
          matchDate: new Date(m.matchDateUtc),
          matchGroup: m.group,
          phase: STAGE_TO_PHASE[m.stage],
          status: MatchStatus.UPCOMING,
          venue: m.venue,
          city: m.city,
          country: m.country,
          source: m.source,
        },
      });
      matchesCreated++;
    }
  }

  console.log("[seed] done", {
    tournamentSlug: tournament.slug,
    teams: { created: teamsCreated, updated: teamsUpdated, orphansRemoved: orphans.count, total: TEAMS.length },
    matches: {
      created: matchesCreated,
      updated: matchesUpdated,
      preserved: matchesPreserved,
      total: MATCHES.length,
    },
  });
}

main()
  .catch((e) => {
    console.error("[seed] failed", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
