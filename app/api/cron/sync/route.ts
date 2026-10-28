import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { runSourceNow } from "@/lib/sync/runs";
import { fetchBatchForSource, isRunnableKind } from "@/lib/sync/connectors";
import type { SyncSourceRow } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set. */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Nightly sync of every school's auto-sync sources (Google Sheets today; SIS
 * connectors once they ship), using the exact same engine and rules as an
 * upload or "Sync now". Runs with the service
 * role (no user session); every query inside is filtered by the source's
 * org_id. Least-recently-synced sources go first and the job stops starting
 * new ones near the function time limit, so a big backlog finishes over a
 * few nights instead of timing out mid-sync.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const started = Date.now();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("sync_sources")
    .select("id, org_id, kind, name, mapping, config, auto_sync")
    .eq("auto_sync", true)
    .neq("status", "paused")
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(200);
  if (error) {
    console.error("[cron-sync] could not list sources:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { source: string; status: string; error?: string }[] = [];
  for (const source of ((data ?? []) as SyncSourceRow[]).filter((s) => isRunnableKind(s.kind))) {
    if (Date.now() - started > 40_000) {
      results.push({ source: source.id, status: "deferred" });
      continue;
    }
    try {
      const run = await runSourceNow(admin, source.org_id, source, "cron", null, () => fetchBatchForSource(source.org_id, source));
      results.push({ source: source.id, status: run.status, ...(run.error ? { error: run.error } : {}) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[cron-sync] ${source.id} failed:`, message);
      results.push({ source: source.id, status: "failed", error: message });
    }
  }
  return NextResponse.json({ ok: true, ran: results.filter((r) => r.status === "applied").length, results });
}
