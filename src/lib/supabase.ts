import { createBrowserClient as createBrowser } from "@supabase/ssr";

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      `Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL=${url ? "set" : "MISSING"}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${key ? "set" : "MISSING"}`
    );
  }

  return createBrowser(url, key);
}
