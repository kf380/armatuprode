"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Copy, Share2, AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { useApp } from "@/lib/store";
import { useGroups } from "@/lib/hooks";
import type { ApiGroup } from "@/lib/hooks";
import { shareGroupInvite } from "@/lib/share";

const STATUS_LABEL: Record<string, { text: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  ACTIVE: { text: "Activo", tone: "ok" },
  PENDING_PAYMENT: { text: "Pendiente de pago", tone: "warn" },
  PAYMENT_FAILED: { text: "Pago fallido", tone: "danger" },
  PAYMENT_REVERSED: { text: "Pago revertido", tone: "danger" },
  PAUSED: { text: "Pausado", tone: "warn" },
  FINISHED: { text: "Finalizado", tone: "neutral" },
  CANCELLED: { text: "Cancelado", tone: "danger" },
  DRAFT: { text: "Borrador", tone: "neutral" },
};

const PLAN_LABEL: Record<string, string> = {
  FREE: "Gratis",
  PERSONAL_PLUS: "Personal Plus",
  COMMUNITY: "Comunidad",
  BUSINESS: "Empresa",
  WHITE_LABEL: "Custom",
};

export default function OrganizerListPage() {
  const { dbUser, authLoading, isLoggedIn } = useApp();
  const { groups, loading, error, refetch } = useGroups();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Redirect to home if not logged in (after auth resolves)
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      window.location.href = "/?next=/organizer";
    }
  }, [authLoading, isLoggedIn]);

  // Filter to groups the current user actually created. For org-bound groups,
  // we still include them if the user is the creator — admin-only access is
  // a future flow (members invite). This avoids surfacing groups where the
  // user was added as ADMIN but is not the actual organizer.
  const ownGroups: ApiGroup[] = dbUser
    ? groups.filter((g) => g.createdById === dbUser.id)
    : [];

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 md:px-8 py-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-widest">MIS PRODES</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {ownGroups.length} prode{ownGroups.length === 1 ? "" : "s"} creado{ownGroups.length === 1 ? "" : "s"}
          </p>
        </div>
        <a
          href="/organizer/create"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 font-display text-xs font-bold tracking-wider text-bg-primary hover:bg-primary/90 active:scale-[0.97]"
        >
          <Plus size={14} /> CREAR PRODE
        </a>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          {error} —{" "}
          <button onClick={() => refetch()} className="underline">
            reintentar
          </button>
        </div>
      )}

      {/* Empty state */}
      {ownGroups.length === 0 && !loading && (
        <div className="rounded-2xl border border-border-default bg-bg-surface p-8 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <h2 className="font-display text-base font-bold mb-2">Todavía no creaste ningún prode</h2>
          <p className="text-sm text-text-muted mb-5 max-w-sm mx-auto">
            Armá un prode con amigos, familia, tu empresa o tu comunidad. Los invitados juegan gratis.
          </p>
          <a
            href="/organizer/create"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3 font-display text-xs font-bold tracking-wider text-bg-primary hover:bg-primary/90"
          >
            <Plus size={14} /> CREAR EL PRIMERO
          </a>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {ownGroups.map((g) => {
          const statusInfo = STATUS_LABEL[g.status] || { text: g.status, tone: "neutral" as const };
          const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${g.inviteCode}`;
          const toneColor =
            statusInfo.tone === "ok"
              ? "text-primary border-primary/30 bg-primary/10"
              : statusInfo.tone === "warn"
                ? "text-accent border-accent/30 bg-accent/10"
                : statusInfo.tone === "danger"
                  ? "text-danger border-danger/30 bg-danger/10"
                  : "text-text-muted border-border-default bg-bg-primary";

          return (
            <div
              key={g.id}
              className="rounded-2xl border border-border-default bg-bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-3xl shrink-0">{g.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{g.name}</div>
                    <div className="text-xs text-text-muted truncate">
                      {g.tournament} · {g.type === "ORGANIZATION" ? "Organización" : "Personal"} · {PLAN_LABEL[g.planType] || g.planType}
                    </div>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-display tracking-wider font-bold ${toneColor}`}>
                  {statusInfo.text}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-text-secondary mb-3">
                <span>
                  {g.memberCount}/{g.participantLimit} jugadores
                </span>
                {g.prizeDescription && (
                  <span className="text-accent text-[11px] truncate max-w-[55%]" title={g.prizeDescription}>
                    🏆 {g.prizeDescription}
                  </span>
                )}
              </div>

              {g.status === "PENDING_PAYMENT" && (
                <div className="mb-3 rounded-lg border border-accent/30 bg-accent/5 p-2 flex items-center gap-2 text-xs text-text-primary">
                  <AlertTriangle size={12} className="text-accent" />
                  <span>Completá el pago para activar este prode.</span>
                </div>
              )}

              {g.status === "PAYMENT_REVERSED" && (
                <div className="mb-3 rounded-lg border border-danger/30 bg-danger/5 p-2 flex items-center gap-2 text-xs text-text-primary">
                  <Lock size={12} className="text-danger" />
                  <span>Prode pausado por reembolso/contracargo.</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteUrl);
                      setCopiedId(g.id);
                      setTimeout(() => setCopiedId(null), 1500);
                    } catch {
                      // ignore clipboard errors
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs hover:border-primary/40"
                >
                  <Copy size={12} />
                  {copiedId === g.id ? "Copiado!" : "Copiar link"}
                </button>
                <button
                  onClick={() =>
                    shareGroupInvite({
                      name: g.name,
                      emoji: g.emoji,
                      inviteCode: g.inviteCode,
                    })
                  }
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs hover:border-primary/40"
                >
                  <Share2 size={12} /> Compartir
                </button>
                {g.status === "PENDING_PAYMENT" && (
                  <a
                    href={`/organizer/create?continue=${g.id}`}
                    className="flex items-center justify-center gap-1 rounded-lg bg-accent/15 border border-accent/30 px-3 py-2 text-xs font-bold text-accent"
                  >
                    Pagar <ArrowRight size={12} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <a href="/" className="text-xs text-text-muted hover:text-text-secondary">
          ← Volver a la app
        </a>
      </div>
    </div>
  );
}
