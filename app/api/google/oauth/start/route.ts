import { NextResponse } from "next/server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { signToken } from "@/lib/crypto";
import { googleAuthUrl, googleConfigError } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * GET /api/google/oauth/start — owner/admin only. Sends the admin to Google's
 * consent screen (read-only Sheets scope). `state` is signed and carries the
 * org + user + expiry so the callback can't be forged or replayed for
 * another school.
 */
export async function GET() {
  let orgId: string;
  let userId: string;
  try {
    ({ orgId, userId } = await requireRole(ADMIN_ROLES));
  } catch (err) {
    if (err instanceof PermissionError) return NextResponse.redirect(new URL("/settings?google=forbidden#data", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  const configError = googleConfigError();
  if (configError) {
    return NextResponse.redirect(new URL(`/settings?google=error&msg=${encodeURIComponent(configError)}#data`, process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  const state = signToken("google-oauth", JSON.stringify({ o: orgId, u: userId, e: Date.now() + 10 * 60_000 }), 16);
  return NextResponse.redirect(googleAuthUrl(state));
}
