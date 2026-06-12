/**
 * Lightweight sound effects via Web Audio API. No asset bundle, ~0 KB extra.
 *
 * Usage:
 *   import { playPickConfirm, playWinFanfare } from "@/lib/sound-fx";
 *   playPickConfirm();
 *
 * Honors localStorage("ap_sounds_enabled") — defaults OFF until the user
 * opts in via Settings.
 */

const STORAGE_KEY = "ap_sounds_enabled";

export function soundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

let ctxSingleton: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctxSingleton) return ctxSingleton;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctxSingleton = new Ctor();
  return ctxSingleton;
}

function beep(
  ctx: AudioContext,
  freq: number,
  durationMs: number,
  startOffsetMs = 0,
  gain = 0.12,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g);
  g.connect(ctx.destination);

  const start = ctx.currentTime + startOffsetMs / 1000;
  const end = start + durationMs / 1000;
  osc.start(start);
  g.gain.linearRampToValueAtTime(gain, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.stop(end + 0.01);
}

export function playPickConfirm(): void {
  if (!soundsEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  beep(ctx, 880, 80, 0, 0.1, "triangle");
  beep(ctx, 1320, 80, 90, 0.08, "triangle");
}

export function playWinFanfare(): void {
  if (!soundsEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  // Ascending arpeggio: C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => beep(ctx, f, 180, i * 110, 0.1, "triangle"));
}

export function playGolAlert(): void {
  if (!soundsEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  // 3 rising blips
  beep(ctx, 660, 90, 0, 0.12, "square");
  beep(ctx, 880, 90, 110, 0.12, "square");
  beep(ctx, 1320, 140, 230, 0.12, "square");
}
