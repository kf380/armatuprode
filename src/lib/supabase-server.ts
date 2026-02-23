import { createClient } from "@supabase/supabase-js";

export async function getAuthUser(request?: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Try Authorization header first (from authFetch)
  let token: string | null = null;

  if (request) {
    token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null;
  }

  // If we have a header check in Next.js request context
  if (!token && typeof globalThis !== "undefined") {
    try {
      const { headers } = await import("next/headers");
      const headerStore = await headers();
      token = headerStore.get("authorization")?.replace("Bearer ", "") ?? null;
    } catch {
      // Not in a server context
    }
  }

  if (!token) {
    return { user: null, supabase };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, supabase };
  }

  return { user, supabase };
}
