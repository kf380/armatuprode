"use client";

import { memo, useEffect, useState } from "react";

/**
 * Tick aislado del countdown. Cada 30s recalcula el label SOLO de este
 * componente, sin disparar re-render del árbol padre. Antes el tick vivía
 * en HomeScreen y re-renderaba ~1000 líneas cada medio minuto.
 */
function format(kickoff: number, now: number): string | null {
  const diff = kickoff - now;
  if (diff <= 0) return null;
  const totalMin = Math.floor(diff / 60_000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin % (60 * 24)) / 60);
  const m = totalMin % 60;
  if (d > 0) return `en ${d}d ${h}h`;
  if (h > 0) return `en ${h}h ${m}m`;
  return `en ${m}m`;
}

function CountdownLabelInner({ kickoff }: { kickoff: number }) {
  const [label, setLabel] = useState<string | null>(() => format(kickoff, Date.now()));
  useEffect(() => {
    const update = () => setLabel(format(kickoff, Date.now()));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [kickoff]);
  if (!label) return null;
  return <>{label}</>;
}

export const CountdownLabel = memo(CountdownLabelInner);
