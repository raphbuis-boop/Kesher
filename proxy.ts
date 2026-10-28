import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Skip static assets and Next.js internals; always run on page routes
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow unauthenticated access to the public landing page, login, legal pages,
  // auth callback (required for OAuth + magic link + password reset), email
  // unsubscribe links (clicked by logged-out parents), team invite links
  // (/invite/[token] — the page itself handles signed-out vs signed-in), and webhooks
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/auth/callback" ||
    pathname === "/privacy" ||
    pathname === "/sms-terms" ||
    pathname === "/terms" ||
    pathname === "/contact" ||
    pathname === "/cta" ||
    pathname === "/opt-in" ||
    pathname === "/sample-form" ||
    pathname === "/unsubscribe" ||
    pathname === "/api/unsubscribe" ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/api/webhooks/")
  ) {
    return NextResponse.next();
  }

  // Build a response object that cookie mutations can be written onto
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session and verify it. getClaims() checks the JWT signature
  // (locally against the cached JWKS with asymmetric signing keys, or via the
  // Auth server for legacy HS256 keys) — never trusts the cookie unverified,
  // but skips the Auth-server round trip getUser() made on every navigation.
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Preserve the intended destination so we can redirect back after login
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
