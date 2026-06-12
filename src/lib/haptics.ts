/**
 * Tiny haptic helper. No-op when Vibration API isn't available (desktop,
 * iOS Safari pre-16.4). Mantenemos los patterns chicos así no se siente
 * spam de vibración en clicks frecuentes.
 */

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* iOS Safari throws on some versions even cuando typeof checks pasaron */
  }
}

/** Para tap suave: cualquier +/- en quick-pick, toggle, etc. */
export function tapLight(): void {
  vibrate(10);
}

/** Para confirm: save successful, ack del server, predicción guardada. */
export function tapConfirm(): void {
  vibrate([10, 30, 10]);
}

/** Para celebración: acierto, level-up, GOL. */
export function tapCelebrate(): void {
  vibrate([15, 50, 30, 50, 15]);
}
