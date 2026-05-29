"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ArrowLeft, ArrowRight, Building2, User, Loader } from "lucide-react";
import { useApp } from "@/lib/store";
import {
  useOrganizations,
  useCreateOrganization,
  useCreateGroupActivationPayment,
  useTournaments,
  usePublicConfig,
} from "@/lib/hooks";
import type { ApiPlanType, ApiGroupKind } from "@/lib/hooks";

// Plans we offer in the public UI. WHITE_LABEL is intentionally absent.
const PERSONAL_PLAN_OPTIONS: Array<{
  value: Extract<ApiPlanType, "FREE" | "PERSONAL_PLUS">;
  label: string;
  description: string;
  maxPlayers: number;
  priceLabel: string;
}> = [
  { value: "FREE", label: "Gratis", description: "Hasta 10 jugadores", maxPlayers: 10, priceLabel: "$0" },
  { value: "PERSONAL_PLUS", label: "Personal Plus", description: "Hasta 50 jugadores + premio", maxPlayers: 50, priceLabel: "USD 12" },
];

const ORG_PLAN_OPTIONS: Array<{
  value: Extract<ApiPlanType, "COMMUNITY" | "BUSINESS">;
  label: string;
  description: string;
  maxPlayers: number;
  priceLabel: string;
}> = [
  { value: "COMMUNITY", label: "Comunidad", description: "Hasta 100 jugadores · USD 3/jugador (mín USD 60)", maxPlayers: 100, priceLabel: "desde USD 60" },
  { value: "BUSINESS", label: "Empresa", description: "Hasta 1000 jugadores · USD 5/jugador (mín USD 300)", maxPlayers: 1000, priceLabel: "desde USD 300" },
];

const FEE_BASE_USD = 5;
const FEE_PCT = 0.07;
const FEE_CAP_USD = 400;
const ARS_RATE = 1200;

function calculatePoolFee(declaredPoolArs: number) {
  const poolUsd = declaredPoolArs / ARS_RATE;
  const variable = poolUsd * FEE_PCT;
  const raw = FEE_BASE_USD + variable;
  const cappedAt = raw > FEE_CAP_USD;
  const usd = Math.min(Math.max(raw, FEE_BASE_USD), FEE_CAP_USD);
  return {
    usd: Math.round(usd * 100) / 100,
    ars: Math.round(usd * ARS_RATE),
    cappedAt,
  };
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

export default function OrganizerCreatePage() {
  const { authLoading, isLoggedIn, authFetch } = useApp();
  const { config } = usePublicConfig();
  const { organizations, refetch: refetchOrgs, loading: orgsLoading } = useOrganizations();
  const { createOrganization } = useCreateOrganization();
  const { createActivationPayment } = useCreateGroupActivationPayment();
  const { tournaments, loading: tournamentsLoading } = useTournaments();

  // Step 1: type
  const [groupType, setGroupType] = useState<ApiGroupKind | null>(null);
  // Org selection / creation
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgForm, setOrgForm] = useState({ slug: "", name: "", logoUrl: "" });
  // Step 2: plan
  const [planType, setPlanType] = useState<ApiPlanType | null>(null);
  // Step 3: details
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🏆");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [rulesDescription, setRulesDescription] = useState("");
  const [publicJoinEnabled, setPublicJoinEnabled] = useState(false);
  const [estimatedPlayers, setEstimatedPlayers] = useState(20);
  // Phase 2: Manual Pool (only enabled when feature flag is on)
  const [hasDeclaredPool, setHasDeclaredPool] = useState<boolean | null>(null);
  const [declaredPoolEntry, setDeclaredPoolEntry] = useState<number>(1000);
  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualPoolsEnabled = !!config?.flags.enableManualPools;

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      window.location.href = "/?next=/organizer/create";
    }
  }, [authLoading, isLoggedIn]);

  const tournamentId = useMemo(() => tournaments?.[0]?.id ?? null, [tournaments]);

  const planOptions = groupType === "ORGANIZATION" ? ORG_PLAN_OPTIONS : PERSONAL_PLAN_OPTIONS;

  // Reset plan when type changes
  useEffect(() => {
    setPlanType(null);
  }, [groupType]);

  const isPremium = planType !== null && planType !== "FREE";

  const handleCreateOrg = async () => {
    setError(null);
    if (!SLUG_RE.test(orgForm.slug)) {
      setError("Slug inválido (3-40 chars, minúsculas/números/guiones)");
      return;
    }
    if (orgForm.name.trim().length < 2) {
      setError("Nombre demasiado corto");
      return;
    }
    if (orgForm.logoUrl && !/^https:\/\//.test(orgForm.logoUrl)) {
      setError("logoUrl debe empezar con https://");
      return;
    }
    try {
      setCreatingOrg(true);
      const org = await createOrganization({
        slug: orgForm.slug,
        name: orgForm.name.trim(),
        logoUrl: orgForm.logoUrl || undefined,
      });
      await refetchOrgs();
      setOrganizationId(org.id);
      setOrgForm({ slug: "", name: "", logoUrl: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear organización");
    } finally {
      setCreatingOrg(false);
    }
  };

  const usingManualPool = manualPoolsEnabled && hasDeclaredPool === true;
  const declaredPoolValid = !usingManualPool || (Number.isInteger(declaredPoolEntry) && declaredPoolEntry > 0);

  const canSubmit =
    !!groupType &&
    !!planType &&
    !!tournamentId &&
    name.trim().length >= 2 &&
    (groupType !== "ORGANIZATION" || !!organizationId) &&
    // Phase 2: if manual pool is offered, organizer must answer Y/N
    (!manualPoolsEnabled || hasDeclaredPool !== null) &&
    declaredPoolValid;

  const poolFeeQuote = useMemo(() => {
    if (!usingManualPool) return null;
    return calculatePoolFee(declaredPoolEntry * estimatedPlayers);
  }, [usingManualPool, declaredPoolEntry, estimatedPlayers]);

  const handleSubmit = async () => {
    if (!canSubmit || !groupType || !planType || !tournamentId) return;
    setError(null);
    setSubmitting(true);
    try {
      // 1) Create the group
      const createRes = await authFetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          emoji,
          tournamentId,
          type: groupType,
          planType,
          organizationId: groupType === "ORGANIZATION" ? organizationId : undefined,
          prizeType: prizeDescription.trim() ? "MANUAL_FIXED" : "NONE",
          prizeDescription: prizeDescription.trim() || undefined,
          rulesDescription: rulesDescription.trim() || undefined,
          publicJoinEnabled,
          // Phase 2: Manual Pool (only if flag enabled + organizer opted in)
          ...(usingManualPool
            ? { moneyMode: "MANUAL_POOL", declaredPoolEntry }
            : {}),
          // EXPLICITLY no hasPool / no entryFee — legacy cash pools out of scope.
        }),
      });
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo crear el prode");
      }
      const { group } = await createRes.json();

      // 2) FREE → done. Premium → create activation payment + redirect to MP.
      if (!isPremium) {
        window.location.href = "/organizer";
        return;
      }
      const { initPoint } = await createActivationPayment({
        groupId: group.id,
        planType,
        estimatedPlayers,
      });
      window.location.href = initPoint;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 md:px-8 py-8 pb-20">
      <div className="flex items-center justify-between mb-6">
        <a
          href="/organizer"
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary"
        >
          <ArrowLeft size={14} /> Volver
        </a>
        <h1 className="font-display text-base font-bold tracking-widest">CREAR PRODE</h1>
        <div className="w-12" />
      </div>

      {/* No-tournament banner — wizard cannot complete without a tournament */}
      {!tournamentsLoading && !tournamentId && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger">
          No hay torneo activo configurado. Contactá soporte en{" "}
          <strong>hola@armatuprode.com.ar</strong> para que activen un torneo.
        </div>
      )}

      {/* Disclaimer */}
      <div className="mb-6 rounded-xl border border-border-default bg-bg-surface p-3 text-xs text-text-secondary leading-relaxed">
        ArmaTuProde no reparte dinero automáticamente. El premio, si existe, lo define
        y entrega el organizador según las reglas del prode.
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Step 1 — Tipo */}
      <Step number={1} title="Tipo de prode">
        <div className="grid grid-cols-2 gap-3">
          {config.flags.enablePersonalGroups && (
            <button
              onClick={() => setGroupType("PERSONAL")}
              className={`rounded-2xl border p-4 text-left transition-all ${
                groupType === "PERSONAL"
                  ? "border-primary bg-primary/10"
                  : "border-border-default bg-bg-surface hover:border-primary/30"
              }`}
            >
              <User size={20} className="mb-2 text-primary" />
              <div className="font-bold text-sm">Personal / amigos</div>
              <div className="text-xs text-text-muted">Familia, oficina chica, grupo de WhatsApp</div>
            </button>
          )}
          {config.flags.enableB2bOrganizers && (
            <button
              onClick={() => setGroupType("ORGANIZATION")}
              className={`rounded-2xl border p-4 text-left transition-all ${
                groupType === "ORGANIZATION"
                  ? "border-secondary bg-secondary/10"
                  : "border-border-default bg-bg-surface hover:border-secondary/30"
              }`}
            >
              <Building2 size={20} className="mb-2 text-secondary" />
              <div className="font-bold text-sm">Empresa / comunidad</div>
              <div className="text-xs text-text-muted">Bar, club, streamer, organización</div>
            </button>
          )}
        </div>
      </Step>

      {/* Step 1.5 — Organization */}
      {groupType === "ORGANIZATION" && (
        <Step number={2} title="Organización">
          {orgsLoading ? (
            <div className="text-xs text-text-muted">Cargando...</div>
          ) : (
            <>
              {organizations.length > 0 && (
                <div className="space-y-2 mb-3">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => setOrganizationId(org.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-all flex items-center gap-3 ${
                        organizationId === org.id
                          ? "border-primary bg-primary/10"
                          : "border-border-default bg-bg-surface hover:border-primary/30"
                      }`}
                    >
                      {org.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.logoUrl} alt={org.name} className="h-8 w-8 rounded-lg object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-bg-primary border border-border-default flex items-center justify-center text-xs font-bold text-text-muted">
                          {org.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{org.name}</div>
                        <div className="text-xs text-text-muted truncate">@{org.slug}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <details className="rounded-xl border border-border-default bg-bg-surface p-3">
                <summary className="cursor-pointer text-xs font-bold tracking-wider">
                  + Crear nueva organización
                </summary>
                <div className="mt-3 space-y-2">
                  <input
                    placeholder="Nombre (Bar Don Pedro)"
                    value={orgForm.name}
                    onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Slug único (bar-don-pedro)"
                    value={orgForm.slug}
                    onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Logo URL (https://... opcional)"
                    value={orgForm.logoUrl}
                    onChange={(e) => setOrgForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleCreateOrg}
                    disabled={creatingOrg || !orgForm.slug || !orgForm.name}
                    className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-bg-primary disabled:opacity-50"
                  >
                    {creatingOrg ? "Creando..." : "Crear organización"}
                  </button>
                </div>
              </details>
            </>
          )}
        </Step>
      )}

      {/* Step 2 — Plan */}
      {groupType && (groupType === "PERSONAL" || organizationId) && (
        <Step number={groupType === "ORGANIZATION" ? 3 : 2} title="Elegí un plan">
          <div className="space-y-2">
            {planOptions.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlanType(p.value)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  planType === p.value
                    ? "border-primary bg-primary/10"
                    : "border-border-default bg-bg-surface hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">{p.label}</div>
                    <div className="text-xs text-text-muted">{p.description}</div>
                  </div>
                  <div className="text-sm font-display font-bold text-primary">{p.priceLabel}</div>
                </div>
              </button>
            ))}
          </div>
          {/* For per-player plans, ask estimated players */}
          {planType === "COMMUNITY" || planType === "BUSINESS" ? (
            <div className="mt-3">
              <label className="text-xs text-text-muted mb-1 block">
                Cantidad estimada de jugadores
              </label>
              <input
                type="number"
                min={1}
                value={estimatedPlayers}
                onChange={(e) => setEstimatedPlayers(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
              />
              <div className="text-[10px] text-text-muted mt-1">
                El precio se calcula con un mínimo según plan.
              </div>
            </div>
          ) : null}
        </Step>
      )}

      {/* Step 2.5 — ¿Hay pozo? (Phase 2, gated) */}
      {planType && manualPoolsEnabled && (
        <Step
          number={groupType === "ORGANIZATION" ? 4 : 3}
          title="¿Hay un pozo entre los jugadores?"
        >
          <div className="space-y-3">
            <p className="text-xs text-text-muted leading-relaxed">
              Si tu prode tiene cobro entre jugadores (entrada por persona),
              ArmaTuProde puede mostrar el pozo y registrar quién pagó.
              <br />
              <strong className="text-text-primary">
                ArmaTuProde no procesa este dinero.
              </strong>{" "}
              Vos cobrás y entregás el premio por fuera.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setHasDeclaredPool(false)}
                className={`rounded-xl border px-3 py-3 text-sm font-display font-bold tracking-wider ${
                  hasDeclaredPool === false
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border-default bg-bg-surface text-text-muted"
                }`}
              >
                NO, SIN POZO
                <div className="text-[10px] text-text-muted font-normal tracking-normal mt-1">
                  Plan fijo
                </div>
              </button>
              <button
                onClick={() => setHasDeclaredPool(true)}
                className={`rounded-xl border px-3 py-3 text-sm font-display font-bold tracking-wider ${
                  hasDeclaredPool === true
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border-default bg-bg-surface text-text-muted"
                }`}
              >
                SÍ, HAY POZO
                <div className="text-[10px] text-text-muted font-normal tracking-normal mt-1">
                  Fee dinámico
                </div>
              </button>
            </div>

            {hasDeclaredPool === true && (
              <div className="space-y-3 rounded-xl border border-border-default bg-bg-surface p-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">
                    Entrada por jugador (ARS)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={500}
                    value={declaredPoolEntry}
                    onChange={(e) =>
                      setDeclaredPoolEntry(Math.max(1, Math.floor(Number(e.target.value) || 0)))
                    }
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">
                    Jugadores estimados
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={estimatedPlayers}
                    onChange={(e) =>
                      setEstimatedPlayers(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
                  />
                </div>
                <div className="rounded-lg bg-bg-primary border border-border-default p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Pozo estimado</span>
                    <span className="font-bold text-text-primary">
                      ${(declaredPoolEntry * estimatedPlayers).toLocaleString("es-AR")} ARS
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">Fee plataforma (USD 5 + 7%)</span>
                    <span className="font-bold text-primary">
                      USD {poolFeeQuote?.usd.toFixed(2) ?? "—"}
                    </span>
                  </div>
                  {poolFeeQuote?.cappedAt && (
                    <div className="text-[10px] text-accent">
                      Tope alcanzado: USD 400 máximo por torneo.
                    </div>
                  )}
                  <div className="text-[10px] text-text-muted pt-1 border-t border-border-default mt-2">
                    El fee lo pagás vos como organizer al activar. La plata
                    del pozo NO pasa por ArmaTuProde.
                  </div>
                </div>
              </div>
            )}
          </div>
        </Step>
      )}

      {/* Step 3 — Datos */}
      {planType && (manualPoolsEnabled ? hasDeclaredPool !== null : true) && (
        <Step number={groupType === "ORGANIZATION" ? (manualPoolsEnabled ? 5 : 4) : (manualPoolsEnabled ? 4 : 3)} title="Datos del prode">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Nombre del prode</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mundial 2026 - Amigos del asado"
                className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Emoji</label>
              <div className="flex gap-2 flex-wrap">
                {["🏆", "⚽", "🔥", "🎯", "🍕", "🎮", "🏟️", "🥇"].map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`h-10 w-10 rounded-lg border text-lg flex items-center justify-center ${
                      emoji === e
                        ? "border-primary/50 bg-primary/10"
                        : "border-border-default bg-bg-surface"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Premio (opcional, manual)</label>
              <textarea
                value={prizeDescription}
                onChange={(e) => setPrizeDescription(e.target.value)}
                placeholder="Ej: 1° puesto $20.000, 2° una pizza, 3° un asado"
                rows={2}
                className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm resize-none"
              />
              <div className="text-[10px] text-text-muted mt-1">
                Vos definís y entregás el premio. ArmaTuProde no reparte dinero.
              </div>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Reglas (opcional)</label>
              <textarea
                value={rulesDescription}
                onChange={(e) => setRulesDescription(e.target.value)}
                placeholder="Cierre de inscripción al inicio del torneo. Desempate por exactos."
                rows={2}
                className="w-full rounded-lg border border-border-default bg-bg-primary px-3 py-2 text-sm resize-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={publicJoinEnabled}
                onChange={(e) => setPublicJoinEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-xs">
                Permitir join público (sin link de invitación)
              </span>
            </label>
          </div>
        </Step>
      )}

      {/* Submit */}
      {planType && (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="mt-6 w-full rounded-2xl bg-primary py-4 font-display text-sm font-bold tracking-widest text-bg-primary disabled:opacity-50 flex items-center justify-center gap-2"
          style={canSubmit ? { boxShadow: "0 0 20px rgba(16,185,129,0.3)" } : undefined}
        >
          {submitting ? (
            <><Loader size={14} className="animate-spin" /> CREANDO...</>
          ) : isPremium ? (
            <>IR A PAGAR <ArrowRight size={14} /></>
          ) : (
            <>CREAR PRODE GRATIS <ArrowRight size={14} /></>
          )}
        </button>
      )}
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="font-display text-xs font-bold tracking-widest text-text-muted mb-2">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}
