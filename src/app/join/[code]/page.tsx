import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Users, Calendar, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { flags } from "@/lib/flags";
import { CheckBallLogo } from "@/components/CheckBallLogo";

interface Props {
  params: Promise<{ code: string }>;
}

const STATUS_LABEL: Record<string, { text: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  ACTIVE: { text: "Activo", tone: "ok" },
  PENDING_PAYMENT: { text: "Pendiente de activación", tone: "warn" },
  PAYMENT_FAILED: { text: "Pago pendiente", tone: "danger" },
  PAYMENT_REVERSED: { text: "Pausado", tone: "danger" },
  PAUSED: { text: "Pausado", tone: "warn" },
  FINISHED: { text: "Finalizado", tone: "neutral" },
  CANCELLED: { text: "Cancelado", tone: "danger" },
  DRAFT: { text: "Borrador", tone: "neutral" },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: { _count: { select: { members: true } } },
  });

  if (!group) {
    return { title: "ArmatuProde - Grupo no encontrado" };
  }

  return {
    title: `Unite a ${group.emoji} ${group.name} - ArmatuProde`,
    description: `${group._count.members} miembros ya estan compitiendo. Unite y demostra quien sabe mas!`,
    openGraph: {
      title: `${group.emoji} ${group.name}`,
      description: `${group._count.members} miembros jugando en ArmatuProde`,
      type: "website",
    },
  };
}

/**
 * Public preview of a group invite. Shows group info BEFORE asking the user
 * to log in. The big CTA below redirects to `/?join=CODE` which kicks off the
 * SPA login + join flow.
 *
 * Why server-side instead of client: faster TTFB, SEO-friendly, no flash,
 * and reuses Prisma directly (this is a public read; same data is in
 * /api/groups/by-invite/[code]).
 */
export default async function JoinPreviewPage({ params }: Props) {
  const { code } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: {
      tournament: { select: { name: true } },
      organization: { select: { name: true, logoUrl: true } },
      _count: { select: { members: true } },
    },
  });

  if (!group) {
    notFound();
  }

  const creator = await prisma.user.findUnique({
    where: { id: group.createdById },
    select: { name: true, avatar: true },
  });

  const status = STATUS_LABEL[group.status] ?? { text: group.status, tone: "neutral" as const };
  const cap = `${group._count.members}/${group.participantLimit}`;
  const isFull = group._count.members >= group.participantLimit;

  // Phase 2: Manual Pool — only show if flag on AND group has it configured
  const showPool =
    flags.enableManualPools() &&
    group.moneyMode === "MANUAL_POOL" &&
    group.declaredPoolEntry &&
    group.declaredPoolEntry > 0;

  const toneCls =
    status.tone === "ok"
      ? "text-primary border-primary/30 bg-primary/10"
      : status.tone === "warn"
        ? "text-accent border-accent/30 bg-accent/10"
        : status.tone === "danger"
          ? "text-danger border-danger/30 bg-danger/10"
          : "text-text-muted border-border-default bg-bg-primary";

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Top brand bar */}
      <header className="border-b border-border-default">
        <div className="mx-auto max-w-2xl px-5 md:px-8 py-3 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2">
            <CheckBallLogo size={28} />
            <span className="font-display text-[10px] font-bold tracking-[0.2em]">
              ARMATUPRODE
            </span>
          </Link>
          <Link
            href="/landing"
            className="text-[11px] text-text-muted hover:text-text-primary"
          >
            ¿Qué es?
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 md:px-8 py-8 pb-20">
        <p className="text-[11px] text-text-muted mb-2 text-center">
          Te invitan al prode
        </p>

        {/* Group hero */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">{group.emoji}</div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-2">
            {group.name}
          </h1>
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-text-muted">
            <span>{group.tournament.name}</span>
            <span>·</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-display tracking-wider font-bold ${toneCls}`}>
              {status.text}
            </span>
          </div>
        </div>

        {/* Organization branding (if any) */}
        {group.organization && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-4 mb-4 flex items-center gap-3">
            {group.organization.logoUrl ? (
              <img
                src={group.organization.logoUrl}
                alt={group.organization.name}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-bg-primary border border-border-default flex items-center justify-center text-xs font-bold text-text-muted">
                {group.organization.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">
                Organizado por
              </div>
              <div className="text-sm font-bold truncate">{group.organization.name}</div>
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-border-default bg-bg-surface p-3">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Users size={12} />
              <span className="text-[10px] uppercase tracking-wider">Jugadores</span>
            </div>
            <div className="text-sm font-bold">{cap}</div>
          </div>
          <div className="rounded-xl border border-border-default bg-bg-surface p-3">
            <div className="flex items-center gap-1.5 text-text-muted mb-1">
              <Calendar size={12} />
              <span className="text-[10px] uppercase tracking-wider">Creado por</span>
            </div>
            <div className="text-sm font-bold truncate">{creator?.name ?? "Admin"}</div>
          </div>
        </div>

        {/* Prize */}
        {group.prizeType !== "NONE" && group.prizeDescription && (
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 mb-4 flex items-start gap-3">
            <Trophy size={16} className="text-accent shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-accent/80 mb-1">
                Premio
              </div>
              <div className="text-sm text-text-primary">{group.prizeDescription}</div>
              <div className="text-[11px] text-text-muted mt-1">
                Definido y entregado por el organizador.
              </div>
            </div>
          </div>
        )}

        {/* Rules */}
        {group.rulesDescription && (
          <div className="rounded-2xl border border-border-default bg-bg-surface p-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
              Reglas
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-line">
              {group.rulesDescription}
            </p>
          </div>
        )}

        {/* Manual pool block (Phase 2, gated) */}
        {showPool && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-4">
            <div className="text-[10px] uppercase tracking-wider text-primary/80 mb-2">
              Pozo declarado
            </div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-text-muted">Entrada por jugador</span>
              <span className="font-display text-base font-bold text-primary">
                ${group.declaredPoolEntry!.toLocaleString("es-AR")}{" "}
                {group.declaredPoolCurrency ?? "ARS"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-muted">Pozo estimado</span>
              <span className="font-display text-sm font-bold">
                $
                {(
                  group.declaredPoolEntry! * (group._count.members + 1)
                ).toLocaleString("es-AR")}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-primary/20 text-[11px] text-text-muted leading-relaxed">
              <strong className="text-text-primary">
                ArmaTuProde no procesa este dinero.
              </strong>{" "}
              Pagás directo a {creator?.name ?? "el organizer"} (transferencia,
              MP, efectivo). El premio lo entrega el organizador.
            </div>
          </div>
        )}

        {/* Status warning if not joinable */}
        {group.status !== "ACTIVE" && (
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3 mb-4 text-xs text-text-primary">
            Este prode todavía no está activo o ya cerró. Si entrás, vas a ver
            el detalle pero no vas a poder unirte hasta que el organizador lo
            active.
          </div>
        )}
        {group.status === "ACTIVE" && isFull && (
          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-3 mb-4 text-xs text-text-primary">
            Cupo lleno: {cap}. Pedile al organizador que aumente el límite.
          </div>
        )}

        {/* Main CTA — redirect to SPA login flow with the join code */}
        <Link
          href={`/?join=${code}`}
          className="block w-full rounded-2xl bg-primary py-4 text-center font-display text-sm font-bold tracking-widest text-bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
          style={{ boxShadow: "0 0 24px rgba(16,185,129,0.25)" }}
        >
          ENTRAR AL PRODE <ArrowRight size={14} className="inline ml-1" />
        </Link>

        <p className="text-[11px] text-text-muted text-center mt-3 leading-relaxed">
          Te vamos a pedir crear cuenta o iniciar sesión. Después de eso, te
          unís en un click. <strong className="text-text-secondary">Jugar es gratis.</strong>
        </p>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border-default flex items-center justify-between text-[11px] text-text-muted">
          <Link href="/landing" className="hover:text-text-primary">
            ¿Qué es ArmaTuProde?
          </Link>
          <div className="flex gap-3">
            <Link href="/terms" className="hover:text-text-primary">
              Términos
            </Link>
            <Link href="/privacy" className="hover:text-text-primary">
              Privacidad
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
