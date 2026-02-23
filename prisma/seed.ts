import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL },
  },
});

async function main() {
  // Clean existing data
  await prisma.prediction.deleteMany();
  await prisma.poolContribution.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournament.deleteMany();

  // Create tournament
  const tournament = await prisma.tournament.create({
    data: {
      name: "Mundial 2026",
      type: "WORLD_CUP",
      phase: "GROUP_STAGE",
      startDate: new Date("2026-06-11"),
      endDate: new Date("2026-07-19"),
      active: true,
    },
  });

  // Create matches (aligned with mock-data)
  await prisma.match.createMany({
    data: [
      {
        tournamentId: tournament.id,
        teamACode: "ARG", teamAName: "Argentina", teamAFlag: "🇦🇷",
        teamBCode: "BRA", teamBName: "Brasil", teamBFlag: "🇧🇷",
        matchDate: new Date("2026-06-08T21:00:00-03:00"),
        matchGroup: "Grupo A", phase: "GROUP_STAGE", status: "UPCOMING",
      },
      {
        tournamentId: tournament.id,
        teamACode: "MEX", teamAName: "México", teamAFlag: "🇲🇽",
        teamBCode: "ALE", teamBName: "Alemania", teamBFlag: "🇩🇪",
        matchDate: new Date("2026-06-08T16:00:00-03:00"),
        matchGroup: "Grupo B", phase: "GROUP_STAGE", status: "UPCOMING",
      },
      {
        tournamentId: tournament.id,
        teamACode: "ESP", teamAName: "España", teamAFlag: "🇪🇸",
        teamBCode: "JPN", teamBName: "Japón", teamBFlag: "🇯🇵",
        matchDate: new Date("2026-06-08T13:00:00-03:00"),
        matchGroup: "Grupo C", phase: "GROUP_STAGE", status: "UPCOMING",
      },
      {
        tournamentId: tournament.id,
        teamACode: "FRA", teamAName: "Francia", teamAFlag: "🇫🇷",
        teamBCode: "SEN", teamBName: "Senegal", teamBFlag: "🇸🇳",
        matchDate: new Date("2026-06-09T19:00:00-03:00"),
        matchGroup: "Grupo D", phase: "GROUP_STAGE", status: "UPCOMING",
      },
      {
        tournamentId: tournament.id,
        teamACode: "ING", teamAName: "Inglaterra", teamAFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        teamBCode: "USA", teamBName: "Estados Unidos", teamBFlag: "🇺🇸",
        matchDate: new Date("2026-06-09T16:00:00-03:00"),
        matchGroup: "Grupo E", phase: "GROUP_STAGE", status: "UPCOMING",
      },
      {
        tournamentId: tournament.id,
        teamACode: "POR", teamAName: "Portugal", teamAFlag: "🇵🇹",
        teamBCode: "URU", teamBName: "Uruguay", teamBFlag: "🇺🇾",
        matchDate: new Date("2026-06-09T13:00:00-03:00"),
        matchGroup: "Grupo F", phase: "GROUP_STAGE", status: "UPCOMING",
      },
      {
        tournamentId: tournament.id,
        teamACode: "ARG", teamAName: "Argentina", teamAFlag: "🇦🇷",
        teamBCode: "MEX", teamBName: "México", teamBFlag: "🇲🇽",
        matchDate: new Date("2026-06-06T21:00:00-03:00"),
        matchGroup: "Grupo A", phase: "GROUP_STAGE", status: "FINISHED",
        scoreA: 2, scoreB: 1,
      },
      {
        tournamentId: tournament.id,
        teamACode: "BRA", teamAName: "Brasil", teamAFlag: "🇧🇷",
        teamBCode: "SER", teamBName: "Serbia", teamBFlag: "🇷🇸",
        matchDate: new Date("2026-06-06T16:00:00-03:00"),
        matchGroup: "Grupo A", phase: "GROUP_STAGE", status: "FINISHED",
        scoreA: 2, scoreB: 0,
      },
    ],
  });

  console.log("Seed completed: 1 tournament + 8 matches");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
