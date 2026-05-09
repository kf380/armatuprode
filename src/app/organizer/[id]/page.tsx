"use client";

import { useEffect, useMemo, useState, use } from "react";
import {
  Loader2,
  Copy,
  Share2,
  ArrowLeft,
  Users,
  Settings,
  Receipt,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import {
  useOrganizerGroup,
  useGroupBilling,
  useUpdateGroup,
  useResumeGroupPayment,
  type ApiPrizeType,
} from "@/lib/hooks";
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

type TabKey = "resumen" | "jugadores" | "config" | "billing";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "resumen", label: "Resumen", icon: LayoutDashboard },
  { key: "jugadores", label: "Jugadores", icon: Users },
  { key: "config", label: "Config", icon: Settings },
  { key: "billing", label: "Billing", icon: Receipt },
];

export default function OrganizerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { authLoading, isLoggedIn } = useApp();
  const { group, loading, error, refetch } = useOrganizerGroup(id);
  const [tab, setTab] = useState<TabKey>("resumen");

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      window.location.href = `/?next=/organizer/${id}`;
    }
  }, [authLoading, isLoggedIn, id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen px-5 py-12 max-w-md mx-auto">
        <Link href="/organizer" className="text-xs text-text-muted">← Volver a mis prodes</Link>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm text-text-primary">
          {error || "No se pudo cargar el prode"}
          <button onClick={() => refetch()} className="ml-2 underline text-primary">
            reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!group.permissions.canEdit) {
    return (
      <div className="min-h-screen px-5 py-12 max-w-md mx-auto">
        <Link href="/organizer" className="text-xs text-text-muted">← Volver a mis prodes</Link>
        <div className="mt-6 rounded-2xl border border-border-default bg-bg-surface p-5 text-sm text-text-primary">
          <Lock size={18} className="text-text-muted mb-2" />
          Solo el creador del prode (o un admin de la organización) puede usar
          este panel. Si jugás en este prode, andá a la app principal.
        </div>
      </div>
    );
  }

  const status = STATUS_LABEL[group.status] || { text: group.status, tone: "neutral" as const };
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${group.inviteCode}` : "";

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-6 py-6 pb-20">
      <Link
        href="/organizer"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={12} /> Mis prodes
      </Link>

      <div className="flex items-start gap-3 mb-3">
        <span className="text-4xl shrink-0">{group.emoji}</span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-bold tracking-wide truncate">{group.name}</h1>
          <div className="text-xs text-text-muted truncate">
            {group.tournament} · {group.type === "ORGANIZATION" ? "Organización" : "Personal"} ·{" "}
            {PLAN_LABEL[group.planType] || group.planType}
          </div>
          {group.organization && (
            <div className="text-xs text-text-muted truncate mt-0.5">{group.organization.name}</div>
          )}
        </div>
        <StatusBadge tone={status.tone}>{status.text}</StatusBadge>
      </div>

      {/* Status banner */}
      {group.status === "PENDING_PAYMENT" && (
        <Banner tone="warn">
          <AlertTriangle size={14} />
          <span>El prode todavía no está activo. Completá el pago para que jugadores puedan unirse.</span>
        </Banner>
      )}
      {group.status === "PAYMENT_FAILED" && (
        <Banner tone="danger">
          <AlertTriangle size={14} />
          <span>El último intento de pago falló. Podés reintentar desde Billing.</span>
        </Banner>
      )}
      {group.status === "PAYMENT_REVERSED" && (
        <Banner tone="danger">
          <Lock size={14} />
          <span>El pago fue reembolsado. El prode quedó pausado hasta nuevo pago.</span>
        </Banner>
      )}

      {/* Tabs */}
      <nav className="flex gap-1 mt-4 mb-4 border-b border-border-default">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-display tracking-wider font-bold border-b-2 -mb-px ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </nav>

      {tab === "resumen" && <TabResumen group={group} inviteUrl={inviteUrl} />}
      {tab === "jugadores" && <TabJugadores group={group} />}
      {tab === "config" && <TabConfig group={group} onSaved={refetch} />}
      {tab === "billing" && <TabBilling groupId={id} canView={group.permissions.canViewBilling} canResume={group.permissions.canResumePayment} />}
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: "ok" | "warn" | "danger" | "neutral"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "text-primary border-primary/30 bg-primary/10"
      : tone === "warn"
        ? "text-accent border-accent/30 bg-accent/10"
        : tone === "danger"
          ? "text-danger border-danger/30 bg-danger/10"
          : "text-text-muted border-border-default bg-bg-primary";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-display tracking-wider font-bold ${cls}`}>
      {children}
    </span>
  );
}

function Banner({ tone, children }: { tone: "warn" | "danger" | "info"; children: React.ReactNode }) {
  const cls =
    tone === "warn"
      ? "border-accent/30 bg-accent/5"
      : tone === "danger"
        ? "border-danger/30 bg-danger/5"
        : "border-primary/30 bg-primary/5";
  return (
    <div className={`mt-3 rounded-xl border ${cls} px-3 py-2 flex items-center gap-2 text-xs text-text-primary`}>
      {children}
    </div>
  );
}

// --- Tabs ---

function TabResumen({
  group,
  inviteUrl,
}: {
  group: NonNullable<ReturnType<typeof useOrganizerGroup>["group"]>;
  inviteUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Jugadores" value={`${group.memberCount}/${group.participantLimit}`} />
        <Stat label="Tipo" value={group.type === "ORGANIZATION" ? "Organización" : "Personal"} />
        <Stat label="Plan" value={PLAN_LABEL[group.planType] || group.planType} />
        <Stat label="Estado" value={STATUS_LABEL[group.status]?.text ?? group.status} />
      </div>

      <Card title="Premio">
        {group.prizeType === "NONE" || !group.prizeDescription ? (
          <p className="text-sm text-text-muted">
            Sin premio definido. Editá en la pestaña Config para sumar uno.
          </p>
        ) : (
          <div className="flex items-start gap-2">
            <Trophy size={16} className="text-accent mt-0.5 shrink-0" />
            <div>
              <div className="text-sm text-text-primary">{group.prizeDescription}</div>
              <div className="text-[11px] text-text-muted mt-0.5">
                Premio manual gestionado por el organizador. ArmaTuProde no
                custodia ni reparte premios.
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title="Reglas">
        {group.rulesDescription ? (
          <p className="text-sm text-text-secondary whitespace-pre-line">{group.rulesDescription}</p>
        ) : (
          <p className="text-sm text-text-muted">Sin reglas custom. Se usa la grilla de puntos por defecto.</p>
        )}
      </Card>

      <Card title="Link de invitación">
        <div className="text-xs text-text-muted break-all mb-2">{inviteUrl}</div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* noop */
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs hover:border-primary/40"
          >
            <Copy size={12} /> {copied ? "Copiado!" : "Copiar"}
          </button>
          <button
            onClick={() => shareGroupInvite({ name: group.name, emoji: group.emoji, inviteCode: group.inviteCode })}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-xs hover:border-primary/40"
          >
            <Share2 size={12} /> Compartir
          </button>
        </div>
        <p className="mt-3 text-[11px] text-text-muted">
          Los jugadores invitados entran gratis. ArmaTuProde no cobra a
          jugadores.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-surface p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-sm font-bold text-text-primary mt-0.5">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface p-4">
      <h3 className="font-display text-[10px] tracking-widest font-bold text-text-muted mb-2">{title}</h3>
      {children}
    </div>
  );
}

function TabJugadores({
  group,
}: {
  group: NonNullable<ReturnType<typeof useOrganizerGroup>["group"]>;
}) {
  if (group.members.length === 0) {
    return (
      <div className="rounded-2xl border border-border-default bg-bg-surface p-8 text-center">
        <Users size={28} className="mx-auto text-text-muted mb-2" />
        <div className="text-sm text-text-primary mb-1">Todavía no se sumó nadie</div>
        <p className="text-xs text-text-muted">
          Compartí el link de invitación desde la pestaña Resumen.
        </p>
      </div>
    );
  }

  // Map points from ranking
  const pointsBy: Record<string, number> = {};
  for (const r of group.ranking) pointsBy[r.userId] = r.points;

  return (
    <div className="rounded-2xl border border-border-default bg-bg-surface overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-text-muted border-b border-border-default">
        <span>Jugador</span>
        <span>Rol</span>
        <span>Puntos</span>
      </div>
      {group.members.map((m) => (
        <div key={m.userId} className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2.5 items-center text-sm border-b border-border-default last:border-0">
          <div className="flex items-center gap-2 min-w-0">
            {m.avatar ? (
              <span className="text-xl">{m.avatar}</span>
            ) : (
              <div className="size-7 rounded-full bg-bg-primary border border-border-default" />
            )}
            <div className="min-w-0">
              <div className="text-sm text-text-primary truncate">{m.name}</div>
              <div className="text-[10px] text-text-muted">desde {new Date(m.joinedAt).toLocaleDateString("es-AR")}</div>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-text-muted">{m.role}</span>
          <span className="font-bold text-sm">{pointsBy[m.userId] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function TabConfig({
  group,
  onSaved,
}: {
  group: NonNullable<ReturnType<typeof useOrganizerGroup>["group"]>;
  onSaved: () => void;
}) {
  const { updateGroup } = useUpdateGroup();
  const [prizeType, setPrizeType] = useState<ApiPrizeType>(group.prizeType);
  const [prizeDescription, setPrizeDescription] = useState(group.prizeDescription ?? "");
  const [rulesDescription, setRulesDescription] = useState(group.rulesDescription ?? "");
  const [publicJoinEnabled, setPublicJoinEnabled] = useState(group.publicJoinEnabled);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);

  const dirty = useMemo(
    () =>
      prizeType !== group.prizeType ||
      (prizeDescription || "") !== (group.prizeDescription || "") ||
      (rulesDescription || "") !== (group.rulesDescription || "") ||
      publicJoinEnabled !== group.publicJoinEnabled,
    [prizeType, prizeDescription, rulesDescription, publicJoinEnabled, group],
  );

  const onSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await updateGroup(group.id, {
        prizeType,
        prizeDescription: prizeDescription.trim() || null,
        rulesDescription: rulesDescription.trim() || null,
        publicJoinEnabled,
      });
      setMsg({ tone: "ok", text: "Cambios guardados" });
      onSaved();
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Premio (manual)">
        <label className="block text-xs text-text-muted mb-1">Tipo</label>
        <select
          value={prizeType}
          onChange={(e) => setPrizeType(e.target.value as ApiPrizeType)}
          className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary mb-3"
        >
          <option value="NONE">Sin premio</option>
          <option value="MANUAL_FIXED">Premio manual definido por el organizador</option>
          <option value="SPONSOR">Premio sponsoreado</option>
        </select>
        <label className="block text-xs text-text-muted mb-1">Descripción</label>
        <textarea
          value={prizeDescription}
          onChange={(e) => setPrizeDescription(e.target.value)}
          placeholder="Ej: Asado para el ganador del Mundial"
          rows={2}
          className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary mb-1"
        />
        <p className="text-[11px] text-text-muted">
          El premio lo entrega el organizador. ArmaTuProde no cobra a jugadores
          ni reparte dinero automáticamente.
        </p>
      </Card>

      <Card title="Reglas">
        <textarea
          value={rulesDescription}
          onChange={(e) => setRulesDescription(e.target.value)}
          placeholder="Reglas adicionales del prode (opcional)"
          rows={4}
          className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary"
        />
      </Card>

      <Card title="Acceso">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={publicJoinEnabled}
            onChange={(e) => setPublicJoinEnabled(e.target.checked)}
            className="size-4 rounded border-border-default"
          />
          <div>
            <div className="text-sm text-text-primary">Permitir unirse desde el link público</div>
            <div className="text-[11px] text-text-muted">
              Si está apagado, solo entran jugadores que vos agregues manualmente.
            </div>
          </div>
        </label>
      </Card>

      <div className="flex items-center gap-3 sticky bottom-3 bg-bg-primary/90 backdrop-blur p-2 rounded-xl border border-border-default">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-display font-bold tracking-wider text-bg-primary disabled:opacity-40"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {msg && (
          <span className={`flex items-center gap-1 text-xs ${msg.tone === "ok" ? "text-primary" : "text-danger"}`}>
            {msg.tone === "ok" && <CheckCircle2 size={12} />}
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}

function TabBilling({ groupId, canView, canResume }: { groupId: string; canView: boolean; canResume: boolean }) {
  const { billing, loading, error, refetch } = useGroupBilling(canView ? groupId : null);
  const { resume } = useResumeGroupPayment();
  const [resuming, setResuming] = useState(false);
  const [resumeMsg, setResumeMsg] = useState<{ tone: "ok" | "warn" | "danger"; text: string } | null>(null);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-border-default bg-bg-surface p-5 text-sm text-text-muted">
        Solo el dueño del prode (o un OWNER de la organización) puede ver la
        facturación.
      </div>
    );
  }

  if (loading) {
    return <Loader2 className="animate-spin text-primary mx-auto" size={20} />;
  }
  if (error || !billing) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm text-text-primary">
        {error || "No se pudo cargar la facturación"}
        <button onClick={() => refetch()} className="ml-2 underline text-primary">
          reintentar
        </button>
      </div>
    );
  }

  const isFree = billing.planType === "FREE";

  const onRetry = async () => {
    setResuming(true);
    setResumeMsg(null);
    try {
      const res = await resume(groupId);
      if (res.initPoint) window.location.href = res.initPoint;
    } catch (e) {
      const err = e as Error & { code?: string; minutesLeft?: number };
      if (err.code === "PENDING_PAYMENT_OPEN") {
        setResumeMsg({
          tone: "warn",
          text: `Ya hay un pago abierto. Esperá ~${err.minutesLeft ?? 2} min o terminalo en la otra pestaña.`,
        });
      } else {
        setResumeMsg({ tone: "danger", text: err.message });
      }
    } finally {
      setResuming(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Plan">
        <div className="text-sm font-bold">{PLAN_LABEL[billing.planType] ?? billing.planType}</div>
        <div className="text-[11px] text-text-muted mt-0.5">
          Hasta {billing.planConfig.maxPlayers} jugadores · analítica {billing.planConfig.analytics}
        </div>
      </Card>

      {isFree ? (
        <Card title="Facturación">
          <p className="text-sm text-text-muted">Plan gratuito sin pagos asociados.</p>
        </Card>
      ) : (
        <>
          <Card title="Cotización actual">
            <div className="text-sm">
              <span className="font-bold">${billing.quoteForCurrentSize.amountArs.toLocaleString("es-AR")} ARS</span>{" "}
              <span className="text-text-muted text-xs">
                (USD {billing.quoteForCurrentSize.amountUsd}, {billing.currentPlayers} jugadores)
              </span>
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              {billing.quoteForCurrentSize.priceMethod === "flat"
                ? "Precio plano"
                : billing.quoteForCurrentSize.priceMethod === "per_player_with_min"
                  ? "Por jugador con mínimo"
                  : "Gratuito"}
            </div>
          </Card>

          <Card title="Estado de pago">
            <div className="text-sm">
              {billing.billingStatus ? (
                <span className="font-bold">{billing.billingStatus}</span>
              ) : (
                <span className="text-text-muted">Sin estado de billing</span>
              )}
            </div>
            {(billing.status === "PENDING_PAYMENT" ||
              billing.status === "PAYMENT_FAILED" ||
              billing.status === "PAYMENT_REVERSED") &&
              canResume && (
                <button
                  onClick={onRetry}
                  disabled={resuming}
                  className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-display font-bold tracking-wider text-bg-primary disabled:opacity-40"
                >
                  {resuming ? "Iniciando pago..." : "Retomar pago"}
                </button>
              )}
            {resumeMsg && (
              <div
                className={`mt-2 text-xs ${
                  resumeMsg.tone === "ok"
                    ? "text-primary"
                    : resumeMsg.tone === "warn"
                      ? "text-accent"
                      : "text-danger"
                }`}
              >
                {resumeMsg.text}
              </div>
            )}
          </Card>

          <Card title={`Órdenes (${billing.orders.length})`}>
            {billing.orders.length === 0 ? (
              <p className="text-sm text-text-muted">Aún no hay órdenes registradas.</p>
            ) : (
              <ul className="divide-y divide-border-default">
                {billing.orders.map((o) => (
                  <li key={o.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-text-primary truncate">{o.description}</div>
                      <div className="text-[10px] text-text-muted">
                        {new Date(o.createdAt).toLocaleString("es-AR")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold">${o.amount.toLocaleString("es-AR")}</div>
                      <div className="text-[10px] text-text-muted">{o.status}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
