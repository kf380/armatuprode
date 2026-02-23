"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Trophy, ArrowRight, Loader2 } from "lucide-react";
import { useApp } from "@/lib/store";

interface InviteGroupInfo {
  id: string;
  name: string;
  emoji: string;
  tournament: string;
  members: number;
  createdBy: string;
  hasPool: boolean;
  poolAmount: number;
  entryFee: number;
  currency: string;
  inviteCode: string;
}

export default function JoinGroupScreen() {
  const { setScreen, setActiveTab, authFetch, isLoggedIn } = useApp();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<InviteGroupInfo | null>(null);

  // Read invite code from URL or localStorage
  const inviteCode = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("join") || localStorage.getItem("pendingJoinCode")
    : null;

  // Fetch group info by invite code
  useEffect(() => {
    if (!inviteCode) {
      setLoading(false);
      return;
    }

    // Clear from URL without reload
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
          setLoading(false);
          return;
        }
        const data = await res.json();
        setGroupInfo(data.group);
        localStorage.removeItem("pendingJoinCode");
      } catch {
        setError("Error de conexion");
      }
      setLoading(false);
    };

    fetchGroup();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!groupInfo) return;

    setJoining(true);
    try {
      const res = await authFetch(`/api/groups/${groupInfo.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: groupInfo.inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          // Already a member, just go to groups
          setJoined(true);
          setTimeout(() => {
            setActiveTab("groups");
            setScreen("main");
          }, 1500);
          setJoining(false);
          return;
        }
        setError(data.error || "Error al unirse al grupo");
        setJoining(false);
        return;
      }

      setJoined(true);
      setTimeout(() => {
        setActiveTab("groups");
        setScreen("main");
      }, 2000);
    } catch {
      setError("Error de conexion");
    }
    setJoining(false);
  };

  // Fallback group data if no invite code
  const group = groupInfo || {
    name: "Grupo",
    emoji: "🏆",
    tournament: "Mundial 2026",
    members: 0,
    createdBy: "",
    hasPool: false,
    poolAmount: 0,
    entryFee: 0,
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
            Ya sos parte de <strong>{group.name}</strong>
          </p>
          <p className="text-sm text-text-muted mt-2">Entrando al grupo...</p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-sm text-text-muted mt-4">Cargando grupo...</p>
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
            {error || "No se encontro el grupo"}
          </h2>
          <p className="text-sm text-text-muted mb-6">
            Verifica el link de invitacion e intenta de nuevo
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-6 mx-auto max-w-lg md:max-w-xl w-full">
      <motion.div
        className="w-full max-w-sm md:max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-base font-bold tracking-[0.2em] text-primary">
            ARMATUPRODE
          </h1>
        </div>

        {/* Invite message */}
        <p className="text-center text-text-secondary text-base mb-6">
          Te invitaron a un grupo
        </p>

        {/* Group card */}
        <div className="rounded-2xl border border-primary/20 bg-bg-surface p-6 mb-6"
          style={{ boxShadow: "0 0 30px rgba(16,185,129,0.08)" }}
        >
          <div className="text-center mb-4">
            <span className="text-5xl">{group.emoji}</span>
          </div>
          <h2 className="text-center text-xl font-bold mb-1">{group.name}</h2>
          <p className="text-center text-sm text-text-muted mb-5">{group.tournament}</p>

          <div className="flex justify-center gap-6 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-text-secondary">
                <Users size={14} />
                <span className="text-sm font-bold">{group.members}</span>
              </div>
              <span className="text-[10px] text-text-muted">miembros</span>
            </div>
            {group.hasPool && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-accent">
                  <Trophy size={14} />
                  <span className="text-sm font-bold">${group.poolAmount.toLocaleString()}</span>
                </div>
                <span className="text-[10px] text-text-muted">pozo</span>
              </div>
            )}
          </div>

          {group.createdBy && (
            <p className="text-center text-xs text-text-muted">
              Creado por <strong className="text-text-secondary">{group.createdBy}</strong>
            </p>
          )}

          {/* Entry fee notice */}
          {group.hasPool && group.entryFee > 0 && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-center">
              <div className="text-[10px] font-display tracking-widest text-accent/70 mb-0.5">ENTRADA POR PERSONA</div>
              <div className="font-display text-xl font-bold text-accent">${group.entryFee.toLocaleString()}</div>
              <div className="text-[10px] text-text-muted mt-1">
                Al unirte, deberas contribuir al pozo de premios
              </div>
            </div>
          )}
        </div>

        {/* Join button */}
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full rounded-2xl bg-primary py-4 font-display text-sm font-bold tracking-widest text-bg-primary transition-all hover:bg-primary/90 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ boxShadow: "0 0 24px rgba(16,185,129,0.25)" }}
        >
          {joining ? (
            <><Loader2 size={16} className="animate-spin" /> UNIENDOSE...</>
          ) : (
            <>UNIRME AL GRUPO <ArrowRight size={16} /></>
          )}
        </button>

        {/* Skip */}
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
