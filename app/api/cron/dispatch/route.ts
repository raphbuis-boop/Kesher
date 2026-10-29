import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { dispatchDue } from "@/lib/send/dispatch";
import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs every few minutes (see the PR notes for Vercel Pro cron or the Supabase
 * pg_cron alternative): turns due recurring sends into messages, sends due
 * scheduled messages, and finishes any send that was interrupted. Uses the
 * service role; everything inside is filtered by org_id.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await dispatchDue(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron-dispatch] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
