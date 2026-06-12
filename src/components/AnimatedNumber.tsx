"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Anima un número entero desde el último valor al nuevo a lo largo de
 * `duration` ms. Si el valor inicial es null/undefined o el target no
 * cambió, muestra directo el target.
 *
 * No usa libs externas — easeOutCubic en rAF.
 */
export default function AnimatedNumber({
  value,
  duration = 700,
  className,
}: {
  value: number | null | undefined;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState<number | null>(value ?? null);
  const fromRef = useRef<number | null>(value ?? null);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null) {
      setDisplay(null);
      fromRef.current = null;
      return;
    }
    if (fromRef.current == null) {
      // First real value — render directly without animating from 0.
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    if (fromRef.current === value) return;

    const from = fromRef.current;
    const delta = value - from;
    startRef.current = performance.now();

    const step = (t: number) => {
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(from + delta * eased);
      setDisplay(current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = value;
        rafRef.current = null;
      }
    };

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{display ?? "…"}</span>;
}
