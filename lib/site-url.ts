/**
 * Site URL helpers for Supabase auth redirect URIs.
 *
 * The broken reset link (pointing to http://localhost:3000 in production) was
 * caused by the Supabase Dashboard Site URL being set to localhost. Two fixes:
 *   1. Set the correct Site URL + Redirect URLs in Supabase Dashboard (see below).
 *   2. Always derive the redirect URL from NEXT_PUBLIC_SITE_URL — never hardcode
 *      a hostname. This file is the single source of truth for that.
 *
 * Supabase Dashboard settings required:
 *   Authentication → URL Configuration
 *     Site URL:      https://www.kesherhq.co
 *     Redirect URLs: https://www.kesherhq.co/auth/callback
 *                    http://localhost:3000/auth/callback
 *
 * .env.local:
 *   NEXT_PUBLIC_SITE_URL=http://localhost:3000
 *
 * Vercel → Production Environment Variables:
 *   NEXT_PUBLIC_SITE_URL=https://www.kesherhq.co
 */

/** Absolute site origin, no trailing slash. */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  // Client-side fallback when env var is absent
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

/**
 * Returns the absolute callback URL to pass as Supabase's `redirectTo`.
 *
 * Usage examples:
 *   // Password reset
 *   supabase.auth.resetPasswordForEmail(email, {
 *     redirectTo: getAuthCallbackUrl(),
 *   });
 *
 *   // OAuth sign-in
 *   supabase.auth.signInWithOAuth({
 *     provider: "google",
 *     options: { redirectTo: getAuthCallbackUrl() },
 *   });
 *
 *   // Magic link
 *   supabase.auth.signInWithOtp({
 *     email,
 *     options: { emailRedirectTo: getAuthCallbackUrl() },
 *   });
 */
export function getAuthCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback`;
}
