import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Supabase PKCE auth callback handler.
 *
 * Supabase redirects here after:
 *   - Password reset   (type=recovery  → /reset-password)
 *   - Magic link login (type=magiclink → /dashboard or ?next=)
 *   - Email confirm    (type=signup    → /dashboard or ?next=)
 *   - OAuth sign-in    (Google, Apple  → /dashboard or ?next=)
 *
 * The ?code= param is exchanged for a session via PKCE. After a successful
 * exchange the auth cookies are set by createSupabaseServerClient's setAll,
 * and the user is redirected to the appropriate page.
 *
 * Register this URL in Supabase Dashboard → Authentication → URL Configuration:
 *   Redirect URLs: https://www.kesherhq.co/auth/callback
 *                  http://localhost:3000/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "recovery" | "signup" | "magiclink"
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset flow: user clicked the reset link in their email.
      // They are now authenticated; redirect to the form where they set a new password.
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", origin));
      }

      // All other flows: go to the requested next page, or dashboard.
      const destination =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/dashboard";
      return NextResponse.redirect(new URL(destination, origin));
    }

    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  // Code missing or exchange failed — send back to login with a clear message
  return NextResponse.redirect(
    new URL(
      `/login?error=${encodeURIComponent(
        "Authentication link expired or invalid. Please try again."
      )}`,
      origin
    )
  );
}
