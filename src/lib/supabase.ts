import { createBrowserClient as createBrowser } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Singleton del browser client. CRÍTICO: si distintos componentes crean
 * instancias separadas, cada una tiene su propio listener onAuthStateChange
 * y race conditions entre ellas pueden romper la persistencia de cookies
 * (un cliente borra lo que otro escribió). Síntoma observado: app pedía
 * iniciar sesión en cada apertura aunque la cookie estuviera vigente.
 */
let instance: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL=${url ? "set" : "MISSING"}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${key ? "set" : "MISSING"}`
    );
  }

  instance = createBrowser(url, key);
  return instance;
}
