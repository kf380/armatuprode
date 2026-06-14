const KEY = "pendingJoinCode";
// 7 días. Antes era 1h, lo cual rompía el flow asíncrono: usuarios que
// abrían el link de invite en WhatsApp pero volvían a la app horas o
// días después perdían el code en silencio y caían en /main sin grupo.
// 7d cubre el caso 'mi amiga me pasó el link el lunes y entré el viernes'.
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Stored = { code: string; ts: number };

export function savePendingJoinCode(code: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, ts: Date.now() } satisfies Stored));
  } catch {}
}

export function readPendingJoinCode(): string | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  if (!raw.startsWith("{")) {
    clearPendingJoinCode();
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.code || typeof parsed.ts !== "number" || Date.now() - parsed.ts > TTL_MS) {
      clearPendingJoinCode();
      return null;
    }
    return parsed.code;
  } catch {
    clearPendingJoinCode();
    return null;
  }
}

export function clearPendingJoinCode() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
