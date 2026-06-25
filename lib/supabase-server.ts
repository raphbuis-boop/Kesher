import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Must be called per-request — never share across requests.
 *
 * Uses the non-deprecated getAll/setAll cookie pattern from @supabase/ssr@0.12+.
 * setAll is wrapped in try/catch so it's safe to call from Server Components
 * where cookies cannot be set (only Server Actions + Route Handlers can set cookies).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — session refresh cookies
            // will be written by the proxy.ts handler instead.
          }
        },
      },
    }
  );
}
