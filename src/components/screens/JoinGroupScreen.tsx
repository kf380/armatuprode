"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Trophy, ArrowRight, Loader2, Lock, AlertTriangle } from "lucide-react";
import { useApp } from "@/lib/store";
import { usePublicConfig } from "@/lib/hooks";
import { readPendingJoinCode, clearPendingJoinCode } from "@/lib/join-code";
import type { ApiGroupStatus, ApiGroupKind, ApiPlanType, ApiPrizeType } from "@/lib/hooks";
import { CheckBallLogo } from "@/components/CheckBallLogo";

interface InviteGroupInfo {
  id: string;
  name: string;
  emoji: string;
  tournament: string;
  memberCount: number;
  createdBy: string;
  inviteCode: string;
  // B2B
  type: ApiGroupKind;
  planType: ApiPlanType;
  status: ApiGroupStatus;
  isPremium: boolean;
  participantLimit: number;
  prizeType: ApiPrizeType;
  prizeDescription: string | null;
  rulesDescription: string | null;
  publicJoinEnabled: boolean;
  organization: { name: string; logoUrl: string | null; slug: string } | null;
  // Legacy (only displayed when ENABLE_REAL_MONEY_POOLS=true)
  hasPool: boolean;
  entryFee: number;
  currency: string;
  // Phase 2: Manual Pool (only sent when ENABLE_MANUAL_POOLS=true)
  moneyMode?: "NONE" | "MANUAL_POOL" | "AUTOMATED_POOL";
  declaredPoolEntry?: number | null;
  declaredPoolCurrency?: string | null;
}

const STATUS_BLOCK_MESSAGE: Record<Exclude<ApiGroupStatus, "ACTIVE">, string> = {
  DRAFT: "Este prode todavía no fue activado.",
  PENDING_PAYMENT: "Este prode todavía no está activo. El organizador está completando el pago de activación.",
  PAUSED: "Este prode está pausado por el organizador.",
  FINISHED: "Este prode ya finalizó.",
  CANCELLED: "Este prode fue cancelado.",
  PAYMENT_FAILED: "El pago de activación falló. Pedile al organizador que vuelva a intentar.",
  PAYMENT_REVERSED: "Este prode está pausado por un problema de pago.",
};

export default function JoinGroupScreen() {
  const { setScreen, setActiveTab, authFetch } = useApp();
  const { config } = usePublicConfig();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<InviteGroupInfo | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);

  const inviteCode = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("join") || readPendingJoinCode()
    : null;

  useEffect(() => {
    if (!inviteCode) {
      setScreen("main");
      return;
    }

    if (typeof window !== "undefined" && window.location.search.includes("join=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("join");
      window.history.replaceState({}, "", url.pathname);
    }

    const fetchGroup = async () => {
      try {
        const res = await fetch(`/api/groups/by-invite/${inviteCode}`);
        if (!res.ok) {
          setError("Grupo no encontrado o link invalido");
          clearPendingJoinCode();
          setLoading(false);
          return;
        }
        const data = await res.json();
        setGroupInfo(data.group);
        clearPendingJoinCode();
      } catch {
        setError("Error de conexion");
      }
      setLoading(false);
    };

    fetchGroup();
  }, [inviteCode, setScreen]);

  const handleJoin = async () => {
    if (!groupInfo) return;
    if (groupInfo.status !== "ACTIVE") return;

    setJoining(true);
    try {
      const res = await authFetch(`/api/groups/${groupInfo.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: groupInfo.inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setJoined(true);
          setTimeout(() => {
            setActiveTab("groups");
            setScreen("main");
          }, 1500);
          setJoining(false);
          return;
        }
        setError(data.error || "Error al unirse al prode");
        setJoining(false);
        return;
      }

      setJoined(true);
      setTimeout(() => {
        setActiveTab("groups");
        setScreen("main");
      }, 2000);
    } catch {
      setError("Error de conexión");
    }
    setJoining(false);
  };

  if (joined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 mx-auto max-w-lg md:max-w-xl w-full">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5 }}
          >
            🎉
          </motion.div>
          <h2 className="font-display text-xl font-bold tracking-wider text-primary mb-2">
            TE UNISTE!
          </h2>
          <p className="text-text-secondary">
            Ya sos parte de <strong>{groupInfo?.name}</strong>
          </p>
          <p className="text-sm text-text-muted mt-2">Entrando al prode...</p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm text-text-muted mt-4">Cargando prode...</p>
      </div>
    );
  }

  if (error || !groupInfo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 mx-auto max-w-lg md:max-w-xl w-full">
        <motion.div
          className="w-full max-w-sm text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-5xl mb-4">😕</div>
          <h2 className="font-display text-lg font-bold tracking-wider mb-2">
            {error || "No se encontró el prode"}
          </h2>
          <p className="text-sm text-text-muted mb-6">
            Verificá el link de invitación e intentá de nuevo
          </p>
          <button
            onClick={() => setScreen("main")}
            className="w-full rounded-2xl border border-border-default bg-bg-surface py-3.5 text-sm font-bold transition-all hover:bg-bg-surface-hover"
          >
            Volver al inicio
          </button>
        </motion.div>
      </div>
    );
  }

  const atCapacity = groupInfo.memberCount >= groupInfo.participantLimit;
  const isOrg = groupInfo.type === "ORGANIZATION";
  const statusBlocked = groupInfo.status !== "ACTIVE";
  const blockMsg =
    statusBlocked && groupInfo.status !== "ACTIVE"
      ? STATUS_BLOCK_MESSAGE[groupInfo.status as Exclude<ApiGroupStatus, "ACTIVE">]
      : atCapacity
        ? `Este prode alcanzó el límite de ${groupInfo.participantLimit} participantes.`
        : null;
  const canJoin = !statusBlocked && !atCapacity;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 mx-auto max-w-lg md:max-w-xl w-full">
      <motion.div
        className="w-full max-w-sm md:max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo / brand */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <CheckBallLogo size={56} />
          <h1 className="font-display text-base font-bold tracking-[0.2em] text-primary">
            ARMATUPRODE
          </h1>
        </div>

        <p className="text-center text-text-secondary text-base mb-2">
          Te invitaron a un prode {isOrg ? "de empresa/comunidad" : "personal"}
        </p>
        <p className="text-center text-xs text-text-muted mb-6">
          Jugar es gratis para invitados.
        </p>

        {/* Group card */}
        <div
          className="rounded-2xl border border-primary/20 bg-bg-surface p-6 mb-6"
          style={{ boxShadow: "0 0 30px rgba(16,185,129,0.08)" }}
        >
          {/* Organization branding */}
          {groupInfo.organization && (
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border-default">
              {groupInfo.organization.logoUrl && !logoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={groupInfo.organization.logoUrl}
                  alt={groupInfo.organization.name}
                  onError={() => setLogoFailed(true)}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-bg-primary border border-border-default flex items-center justify-center text-text-muted text-xs font-bold">
                  {groupInfo.organization.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-xs text-text-muted">Organizado por</div>
                <div className="text-sm font-semibold">{groupInfo.organization.name}</div>
              </div>
            </div>
          )}

          <div className="text-center mb-4">
            <span className="text-5xl">{groupInfo.emoji}</span>
          </div>
          <h2 className="text-center text-xl font-bold mb-1">{groupInfo.name}</h2>
          <p className="text-center text-sm text-text-muted mb-5">{groupInfo.tournament}</p>

          <div className="flex justify-center gap-6 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-text-secondary">
                <Users size={14} />
                <span className="text-sm font-bold">
                  {groupInfo.memberCount}/{groupInfo.participantLimit}
                </span>
              </div>
              <span className="text-[10px] text-text-muted">participantes</span>
            </div>
          </div>

          {groupInfo.createdBy && !groupInfo.organization && (
            <p className="text-center text-xs text-text-muted">
              Creado por <strong className="text-text-secondary">{groupInfo.createdBy}</strong>
            </p>
          )}

          {/* Manual prize */}
          {groupInfo.prizeType !== "NONE" && groupInfo.prizeDescription && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3">
              <div className="flex items-center gap-2 text-[10px] font-display tracking-widest text-accent/80 mb-1">
                <Trophy size={10} /> PREMIO
              </div>
              <div className="text-sm text-text-primary">{groupInfo.prizeDescription}</div>
              <div className="text-[10px] text-text-muted mt-1">
                El organizador define y entrega el premio según las reglas del prode.
              </div>
            </div>
          )}

          {/* Rules */}
          {groupInfo.rulesDescription && (
            <div className="mt-3 rounded-xl border border-border-default bg-bg-primary p-3">
              <div className="text-[10px] font-display tracking-widest text-text-muted mb-1">
                REGLAS
              </div>
              <div className="text-xs text-text-secondary whitespace-pre-line">
                {groupInfo.rulesDescription}
              </div>
            </div>
          )}

          {/* Legacy cash-pool entry — only when flag explicitly ON */}
          {config.flags.enableRealMoneyPools && groupInfo.hasPool && groupInfo.entryFee > 0 && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-center">
              <div className="text-[10px] font-display tracking-widest text-accent/70 mb-0.5">
                ENTRADA
              </div>
              <div className="font-display text-xl font-bold text-accent">
                ${groupInfo.entryFee.toLocaleString()}
              </div>
            </div>
          )}

          {/* Phase 2: Manual Pool — declared pool block (informational, no money custody) */}
          {config.flags.enableManualPools &&
            groupInfo.moneyMode === "MANUAL_POOL" &&
            groupInfo.declaredPoolEntry &&
            groupInfo.declaredPoolEntry > 0 && (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="text-[10px] font-display tracking-widest text-primary/80 mb-1">
                  POZO DECLARADO POR EL ORGANIZADOR
                </div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-xs text-text-muted">Entrada por jugador</span>
                  <span className="font-display text-base font-bold text-primary">
                    ${groupInfo.declaredPoolEntry.toLocaleString("es-AR")}{" "}
                    {groupInfo.declaredPoolCurrency ?? "ARS"}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-text-muted">Pozo estimado actual</span>
                  <span className="font-display text-sm font-bold text-text-primary">
                    $
                    {(
                      groupInfo.declaredPoolEntry * (groupInfo.memberCount + 1)
                    ).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-primary/20 text-[11px] text-text-muted leading-relaxed">
                  <strong className="text-text-primary">
                    ArmaTuProde no procesa este dinero.
                  </strong>{" "}
                  Pagás directo a {groupInfo.createdBy} (transferencia, MP,
                  efectivo). El organizador entrega el premio por fuera.
                </div>
              </div>
            )}
        </div>

        {/* Status / capacity block message */}
        {blockMsg && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-danger mt-0.5 shrink-0" />
            <span className="text-xs text-text-primary">{blockMsg}</span>
          </div>
        )}

        {/* Join button */}
        <button
          onClick={handleJoin}
          disabled={joining || !canJoin}
          className="w-full rounded-2xl bg-primary py-4 font-display text-sm font-bold tracking-widest text-bg-primary transition-all hover:bg-primary/90 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          style={canJoin ? { boxShadow: "0 0 24px rgba(16,185,129,0.25)" } : undefined}
        >
          {joining ? (
            <><Loader2 size={16} className="animate-spin" /> UNIÉNDOSE...</>
          ) : !canJoin ? (
            <><Lock size={14} /> NO DISPONIBLE</>
          ) : (
            <>UNIRME GRATIS <ArrowRight size={16} /></>
          )}
        </button>

        <button
          onClick={() => setScreen("main")}
          className="w-full mt-3 py-3 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          Ahora no
        </button>
      </motion.div>
    </div>
  );
}
