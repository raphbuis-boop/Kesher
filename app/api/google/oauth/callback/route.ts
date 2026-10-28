import { NextRequest, NextResponse } from "next/server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { verifyToken } from "@/lib/crypto";
import { saveGoogleConnection } from "@/lib/google";
import { getAbsoluteBaseUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function back(params: Record<string, string>) {
  const url = new URL("/settings", getAbsoluteBaseUrl() || "http://localhost:3000");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.hash = "data";
  return NextResponse.redirect(url);
}

/**
 * GET /api/google/oauth/callback — Google redirects here with ?code&state.
 * The signed state must match the signed-in admin and their org, and be
 * fresh, before the code is exchanged and the (encrypted) token stored.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) {
    return back({ google: "error", msg: sp.get("error") === "access_denied" ? "Google access was not granted." : "Google sign-in failed." });
  }
  const code = sp.get("code");
  const payload = verifyToken("google-oauth", sp.get("state"), 16);
  if (!code || !payload) return back({ google: "error", msg: "That Google sign-in link isn't valid. Try connecting again." });

  let state: { o: string; u: string; e: number };
  try {
    state = JSON.parse(payload);
  } catch {
    return back({ google: "error", msg: "That Google sign-in link isn't valid. Try connecting again." });
  }
  if (Date.now() > state.e) return back({ google: "error", msg: "That Google sign-in took too long. Try connecting again." });

  try {
    const { orgId, userId } = await requireRole(ADMIN_ROLES);
    if (orgId !== state.o || userId !== state.u) return back({ google: "error", msg: "Sign-in was started by a different account." });
    await saveGoogleConnection(orgId, userId, code);
    return back({ google: "connected" });
  } catch (err) {
    if (err instanceof PermissionError) return back({ google: "error", msg: err.message });
    console.error("[google-oauth] callback failed:", err instanceof Error ? err.message : err);
    return back({ google: "error", msg: err instanceof Error ? err.message : "Couldn't connect Google." });
  }
}
