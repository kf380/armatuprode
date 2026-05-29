/**
 * Panorama general de la DB: cuántos users, grupos, picks, eventos.
 *   npx tsx scripts/db-stats.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const [
    totalUsers,
    usersWithName,
    totalGroups,
    totalMemberships,
    totalPredictions,
    totalActivity,
    totalChatMessages,
    recentUsers,
    groupsByOwner,
    tournaments,
    totalMatches,
    upcomingMatches,
    nextMatches,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { name: { not: "" } } }),
    prisma.group.count(),
    prisma.groupMember.count(),
    prisma.prediction.count(),
    prisma.activityEvent.count(),
    prisma.chatMessage.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { email: true, name: true, createdAt: true, coins: true, xp: true },
    }),
    prisma.group.findMany({
      select: { name: true, createdById: true, createdAt: true, _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tournament.findMany({
      select: { name: true, slug: true, active: true, startDate: true, endDate: true, _count: { select: { matches: true } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.match.count(),
    prisma.match.count({ where: { matchDate: { gte: now }, status: "UPCOMING" } }),
    prisma.match.findMany({
      where: { matchDate: { gte: now }, status: "UPCOMING" },
      orderBy: { matchDate: "asc" },
      take: 5,
      select: { teamAName: true, teamBName: true, matchDate: true, phase: true, tournament: { select: { name: true } } },
    }),
  ]);

  console.log("\n=== Totales DB ===");
  console.log(`Users (tabla User):    ${totalUsers}`);
  console.log(`Groups:                ${totalGroups}`);
  console.log(`Group memberships:     ${totalMemberships}`);
  console.log(`Predictions (picks):   ${totalPredictions}`);
  console.log(`Activity events:       ${totalActivity}`);
  console.log(`Chat messages:         ${totalChatMessages}`);

  console.log("\n=== Últimos 10 users registrados ===");
  for (const u of recentUsers) {
    console.log(`  ${u.createdAt.toISOString().slice(0, 10)}  ${u.email.padEnd(35)} ${u.name}  (xp: ${u.xp})`);
  }

  console.log("\n=== Todos los grupos existentes ===");
  for (const g of groupsByOwner) {
    console.log(`  ${g.createdAt.toISOString().slice(0, 10)}  "${g.name}"  members: ${g._count.members}`);
  }

  console.log("\n=== Tournaments ===");
  for (const t of tournaments) {
    const status = t.active ? "ACTIVO" : "inactivo";
    console.log(
      `  ${status.padEnd(8)} "${t.name}" (slug: ${t.slug ?? "—"})  matches: ${t._count.matches}  ` +
        `start: ${t.startDate.toISOString().slice(0, 10)}  end: ${t.endDate.toISOString().slice(0, 10)}`,
    );
  }

  console.log(`\nTotal matches en DB:      ${totalMatches}`);
  console.log(`Matches UPCOMING futuras: ${upcomingMatches}`);

  console.log("\n=== Próximas 5 fechas predecibles ===");
  if (nextMatches.length === 0) {
    console.log("  ⚠️  NINGUNA — no hay partidos futuros con status=UPCOMING");
  } else {
    for (const m of nextMatches) {
      console.log(
        `  ${m.matchDate.toISOString().slice(0, 16)}  [${m.tournament.name}] ${m.teamAName} vs ${m.teamBName}  (${m.phase})`,
      );
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
