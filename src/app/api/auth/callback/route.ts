import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Open-redirect guard: only accept relative paths that start with a single "/".
 * Blocks:
 *   - Protocol-relative URLs ("//phishing.com" → browser treats as absolute)
 *   - Backslash attacks ("/\\evil.com" → some browsers normalize)
 *   - Absolute URLs ("https://evil.com")
 *   - Insanely long paths
 * Anything suspicious falls back to "/".
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (/^https?:\/\//i.test(raw)) return "/";
  if (raw.length > 512) return "/";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.headers
              .get("cookie")
              ?.split("; ")
              .map((c) => {
                const [name, ...rest] = c.split("=");
                return { name, value: rest.join("=") };
              }) ?? [];
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
