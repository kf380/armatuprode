"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  Loader2,
  TrendingUp,
  ListChecks,
  Sparkles,
  Award,
} from "lucide-react";
import { useApp } from "@/lib/store";
import {
  useBuyPlayerPremium,
  usePlayerPremium,
  usePublicConfig,
  useTournaments,
} from "@/lib/hooks";

const PREMIUM_PRICE_USD = 2;
const ARS_RATE = 1200;

const FEATURES = [
  { icon: TrendingUp, title: "Insights de partidos", body: "Forma reciente, head-to-head y estadísticas extra antes de predecir." },
  { icon: ListChecks, title: "Stats de tu performance", body: "Tu precisión histórica, racha, mejor partido. Todo en un dashboard." },
  { icon: Sparkles, title: "Comodines (próximamente)", body: "Predicción extra de último minuto en partidos clave." },
  { icon: Award, title: "Badge Premium", body: "Distintivo en el ranking de cada prode donde juegues." },
];

export default function PremiumPage() {
  const { authLoading, isLoggedIn } = useApp();
  const { config } = usePublicConfig();
  const { tournaments } = useTournaments();
  const { isPremium, memberships, loading: premiumLoading, refetch } = usePlayerPremium();
  const { buy } = useBuyPlayerPremium();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      window.location.href = "/?next=/premium";
    }
  }, [authLoading, isLoggedIn]);

  const tournament = tournaments?.[0] ?? null;
  const flagOn = !!config?.flags.enablePlayerPremium;

  const handleBuy = async () => {
    if (!tournament) return;
    setPaying(true);
    setError(null);
    try {
      const { initPoint } = await buy(tournament.id);
      window.location.href = initPoint;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setPaying(false);
    }
  };

  if (authLoading || premiumLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 md:px-8 py-6 pb-20">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-3"
      >
        <ArrowLeft size={12} /> Volver
      </Link>

      {/* Hero */}
      <div className="text-center pt-6 pb-8">
        <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-accent/15 border border-accent/30 mb-4">
          <Crown size={28} className="text-accent" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-2">
          ArmaTuProde Premium
        </h1>
        <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
          Desbloqueá insights, stats y comodines para todos tus prodes.{" "}
          <strong className="text-text-primary">USD {PREMIUM_PRICE_USD}</strong> por torneo.
        </p>
      </div>

      {/* Premium status banner */}
      {isPremium && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={14} className="text-accent" />
            <span className="font-display text-xs font-bold tracking-widest text-primary">
              PREMIUM ACTIVO
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Tenés Premium en {memberships.length} torneo{memberships.length === 1 ? "" : "s"}.
          </p>
          {memberships.map((m) => (
            <div key={m.tournamentId} className="text-[11px] text-text-muted mt-1">
              · {m.tournamentName} (válido hasta{" "}
              {new Date(m.validUntil).toLocaleDateString("es-AR")})
            </div>
          ))}
        </div>
      )}

      {/* Features */}
      <ul className="space-y-3 mb-8">
        {FEATURES.map((f) => (
          <li
            key={f.title}
            className="rounded-2xl border border-border-default bg-bg-surface p-4 flex gap-3"
          >
            <f.icon size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-display font-bold text-sm mb-0.5">{f.title}</div>
              <p className="text-xs text-text-secondary leading-relaxed">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {!flagOn ? (
        <div className="rounded-2xl border border-border-default bg-bg-surface p-5 text-center text-sm text-text-muted">
          Premium para jugadores todavía no está disponible. Lo activamos
          pronto.
        </div>
      ) : isPremium ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
          <div className="text-sm text-text-primary font-bold mb-1">
            Ya tenés Premium activo
          </div>
          <p className="text-xs text-text-muted">
            Disfrutá todos los beneficios hasta el final del torneo.
          </p>
        </div>
      ) : !tournament ? (
        <div className="rounded-2xl border border-border-default bg-bg-surface p-5 text-center text-sm text-text-muted">
          No hay torneo activo. Volvé pronto.
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 mb-3 text-xs text-danger">
              {error}
            </div>
          )}
          <button
            onClick={handleBuy}
            disabled={paying}
            className="w-full rounded-2xl bg-primary py-4 font-display text-sm font-bold tracking-widest text-bg-primary hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ boxShadow: "0 0 24px rgba(16,185,129,0.25)" }}
          >
            {paying ? (
              <>
                <Loader2 size={14} className="animate-spin" /> INICIANDO PAGO...
              </>
            ) : (
              <>
                ACTIVAR PREMIUM · USD {PREMIUM_PRICE_USD}{" "}
                <span className="opacity-60 font-normal">
                  (~${(PREMIUM_PRICE_USD * ARS_RATE).toLocaleString("es-AR")} ARS)
                </span>
              </>
            )}
          </button>
          <p className="mt-3 text-[11px] text-text-muted text-center leading-relaxed">
            Pago único por torneo · Procesado por MercadoPago · No es apuesta
            ni juego de azar
          </p>
        </>
      )}
    </div>
  );
}
