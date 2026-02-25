"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/lib/store";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
} as const;

export default function RulesScreen() {
  const { setScreen } = useApp();

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-lg md:max-w-2xl px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <motion.div className="space-y-6" variants={stagger} initial="hidden" animate="show">
          {/* Header */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setScreen("main")}
              className="h-8 w-8 rounded-full border border-border-default flex items-center justify-center text-text-muted hover:text-text-primary"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className="font-display text-xl font-bold tracking-widest">REGLAS DEL JUEGO</h1>
          </motion.div>

          {/* Predicciones */}
          <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
            <h2 className="font-display text-sm font-bold tracking-wider mb-3">PREDICCIONES</h2>
            <ul className="space-y-1.5 text-xs text-text-secondary">
              <li>Se puede predecir hasta el inicio del partido</li>
              <li>Se puede editar la prediccion antes del kick-off</li>
              <li>Una vez que el partido comienza, la prediccion se bloquea</li>
            </ul>
          </motion.div>

          {/* Puntuacion Grupos */}
          <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
            <h2 className="font-display text-sm font-bold tracking-wider mb-3">PUNTUACION — FASE DE GRUPOS</h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">🎯 Resultado exacto</span>
                <span className="font-display font-bold text-accent">+3 pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">✅ Ganador correcto</span>
                <span className="font-display font-bold text-primary">+1 pt</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">❌ Error</span>
                <span className="font-display font-bold text-danger">0 pts</span>
              </div>
            </div>
          </motion.div>

          {/* Puntuacion Knockout */}
          <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
            <h2 className="font-display text-sm font-bold tracking-wider mb-3">PUNTUACION — ELIMINATORIAS</h2>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">🎯 Resultado exacto (90&apos;)</span>
                <span className="font-display font-bold text-accent">+5 pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">✅ Ganador correcto (90&apos;)</span>
                <span className="font-display font-bold text-primary">+2 pts</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">🏆 Clasificado correcto</span>
                <span className="font-display font-bold text-secondary">+3 pts</span>
              </div>
              <div className="mt-2 text-[10px] text-text-muted border-t border-border-default pt-2">
                Maximo por partido: 5 + 3 = 8 pts (exacto + clasificado)
              </div>
            </div>
          </motion.div>

          {/* Desempates */}
          <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
            <h2 className="font-display text-sm font-bold tracking-wider mb-3">DESEMPATES</h2>
            <ol className="space-y-1.5 text-xs text-text-secondary list-decimal list-inside">
              <li>Mas resultados exactos</li>
              <li>Mas ganadores correctos</li>
              <li>Prediccion mas antigua (quien predijo primero)</li>
            </ol>
          </motion.div>

          {/* Coins */}
          <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
            <h2 className="font-display text-sm font-bold tracking-wider mb-3">COINS</h2>
            <div className="space-y-2 text-xs">
              {[
                { action: "Hacer prediccion", coins: "+10" },
                { action: "Ganador correcto", coins: "+20" },
                { action: "Resultado exacto", coins: "+50" },
                { action: "Clasificado correcto (knockout)", coins: "+30" },
                { action: "Racha de 5", coins: "+100" },
                { action: "Matchday completo", coins: "+20" },
                { action: "Invitar amigo (referral)", coins: "+100" },
                { action: "Ser invitado (referido)", coins: "+100" },
              ].map((item) => (
                <div key={item.action} className="flex items-center justify-between">
                  <span className="text-text-secondary">{item.action}</span>
                  <span className="font-display font-bold text-accent">{item.coins}</span>
                </div>
              ))}
              <div className="mt-2 text-[10px] text-text-muted border-t border-border-default pt-2">
                Los coins expiran a los 90 dias. Se consumen los mas antiguos primero (FIFO).
              </div>
            </div>
          </motion.div>

          {/* Boosters */}
          <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
            <h2 className="font-display text-sm font-bold tracking-wider mb-3">BOOSTERS</h2>
            <div className="space-y-3 text-xs">
              <div>
                <div className="font-bold text-text-primary">x2 — Duplicador (100 coins)</div>
                <div className="text-text-muted">Duplica los puntos de una prediccion</div>
              </div>
              <div>
                <div className="font-bold text-text-primary">Shield — Escudo (150 coins)</div>
                <div className="text-text-muted">Protege tu racha si fallas</div>
              </div>
              <div>
                <div className="font-bold text-text-primary">Seguro — Insurance (200 coins)</div>
                <div className="text-text-muted">Si fallas la prediccion, recuperas 150 coins</div>
              </div>
              <div className="mt-2 text-[10px] text-text-muted border-t border-border-default pt-2">
                Se activan antes del inicio del partido. Maximo 1 booster por partido.
              </div>
            </div>
          </motion.div>

          {/* Ligas */}
          <motion.div variants={fadeUp} className="rounded-xl border border-border-default bg-bg-surface p-4">
            <h2 className="font-display text-sm font-bold tracking-wider mb-3">LIGAS / GRUPOS</h2>
            <ul className="space-y-1.5 text-xs text-text-secondary">
              <li>Crea o unite a ligas con amigos</li>
              <li>Ranking interno por liga</li>
              <li>Opcional: pozo con entrada en pesos</li>
              <li>Distribucion de premios configurable (ej: 50% / 30% / 20%)</li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
