import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Sparkles, Target } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CheckBallLogo } from "@/components/CheckBallLogo";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { name: true },
  });
  if (!user) return { title: "ArmatuProde" };
  return {
    title: `${user.name} en ArmatuProde`,
    description: `Mirá los aciertos y badges de ${user.name}. Armá tu propio prode.`,
    openGraph: {
      title: `${user.name} en ArmatuProde`,
      description: `Aciertos, badges y posición de ${user.name}.`,
      type: "profile",
    },
  };
}

/**
 * Public profile page. Anyone with the link sees badges + global rank.
 * No personal info beyond display name + avatar. Used for share-to-WA.
 */
export default async function PublicProfilePage({ params }: Props) {
  const { code } = await params;

  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: {
      id: true,
      name: true,
      avatar: true,
      country: true,
      countryName: true,
      xp: true,
      createdAt: true,
      badges: { select: { badgeId: true, earnedAt: true }, orderBy: { earnedAt: "desc" } },
    },
  });

  if (!user) notFound();

  // Find active tournament for stats. If none, just show empty stats.
  const tournament = await prisma.tournament.findFirst({ where: { active: true } });
  let totalPoints = 0;
  let globalRank: number | null = null;
  let exactos = 0;
  let totalPlayers = 0;

  if (tournament) {
    const [agg, allPoints, exactCount] = await Promise.all([
      prisma.prediction.aggregate({
        where: { userId: user.id, match: { tournamentId: tournament.id } },
        _sum: { points: true },
      }),
      prisma.prediction.groupBy({
        by: ["userId"],
        where: { match: { tournamentId: tournament.id } },
        _sum: { points: true },
      }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM "Prediction" p
        JOIN "Match" m ON p."matchId" = m.id
        WHERE p."userId" = ${user.id}
          AND m."tournamentId" = ${tournament.id}
          AND m.status = 'FINISHED'
          AND p."scoreA" = m."scoreA"
          AND p."scoreB" = m."scoreB"
      `,
    ]);
    totalPoints = agg._sum.points ?? 0;
    exactos = Number(exactCount[0]?.count ?? 0);
    totalPlayers = allPoints.length;
    const above = allPoints.filter((a) => (a._sum.points ?? 0) > totalPoints).length;
    globalRank = above + 1;
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <header className="border-b border-border-default">
        <div className="mx-auto max-w-2xl px-5 md:px-8 py-3 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2">
            <CheckBallLogo size={28} />
            <span className="font-display text-[10px] font-bold tracking-[0.2em]">ARMATUPRODE</span>
          </Link>
          <Link href="/landing" className="text-[11px] text-text-muted hover:text-text-primary">
            ¿Qué es?
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 md:px-8 py-8 pb-20">
        {/* Hero */}
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 h-24 w-24 rounded-full border-2 border-primary/50 bg-bg-surface flex items-center justify-center text-5xl"
            style={{ boxShadow: "0 0 30px rgba(16,185,129,0.25)" }}
          >
            {user.avatar}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-1">{user.name}</h1>
          <div className="text-xs text-text-muted">
            {user.country} {user.countryName}
            {tournament && totalPlayers > 0 && globalRank != null && (
              <> · #{globalRank.toLocaleString()} de {totalPlayers.toLocaleString()}</>
            )}
          </div>
        </div>

        {/* Stats */}
        {tournament && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-xl border border-border-default bg-bg-surface p-3 text-center">
              <Trophy size={16} className="mx-auto text-secondary mb-1.5" />
              <div className="font-display text-lg font-bold text-secondary">{totalPoints}</div>
              <div className="text-[9px] font-display tracking-wider text-text-muted mt-0.5">PUNTOS</div>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-surface p-3 text-center">
              <Target size={16} className="mx-auto text-accent mb-1.5" />
              <div className="font-display text-lg font-bold text-accent">{exactos}</div>
              <div className="text-[9px] font-display tracking-wider text-text-muted mt-0.5">EXACTOS</div>
            </div>
            <div className="rounded-xl border border-border-default bg-bg-surface p-3 text-center">
              <Sparkles size={16} className="mx-auto text-primary mb-1.5" />
              <div className="font-display text-lg font-bold text-primary">{user.badges.length}</div>
              <div className="text-[9px] font-display tracking-wider text-text-muted mt-0.5">BADGES</div>
            </div>
          </div>
        )}

        {/* Badges */}
        {user.badges.length > 0 && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-4 mb-6">
            <div className="font-display text-[10px] tracking-widest text-text-muted mb-3">
              ÚLTIMOS LOGROS
            </div>
            <div className="flex flex-wrap gap-3">
              {user.badges.slice(0, 8).map((b) => (
                <div
                  key={b.badgeId}
                  className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent"
                  title={`Ganado el ${b.earnedAt.toISOString().slice(0, 10)}`}
                >
                  {b.badgeId}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/?ref=${code}`}
          className="block w-full rounded-2xl bg-primary py-4 text-center font-display text-sm font-bold tracking-widest text-bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
          style={{ boxShadow: "0 0 24px rgba(16,185,129,0.25)" }}
        >
          ARMÁ TU PRODE
        </Link>
        <p className="text-[11px] text-text-muted text-center mt-3">
          Si entrás con este link, {user.name} y vos ganan 100 coins.
        </p>
      </main>
    </div>
  );
}
