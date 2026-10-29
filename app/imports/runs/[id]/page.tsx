export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, requireRole } from "@/lib/org";
import type { SyncDiff, SyncStats } from "@/lib/sync/engine";
import type { RunSummary } from "@/lib/sync/runs";
import type { RowProblem } from "@/lib/sync/types";
import { RunDiffView } from "../../SyncImport";
import { RunStatus } from "../../RunStatus";

/** One import/sync run: what it changed (or would have changed). */
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgId } = await requireRole(ADMIN_ROLES);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("sync_runs")
    .select("id, status, trigger, file_name, stats, diff, warnings, error, created_at, applied_at, sync_sources ( name )")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const diff = (data.diff ?? null) as (SyncDiff & { problems?: RowProblem[] }) | null;
  const run: RunSummary = {
    id: data.id as string,
    status: data.status as RunSummary["status"],
    stats: (data.stats ?? {}) as Partial<SyncStats>,
    warnings: (data.warnings ?? []) as string[],
    diff,
    problems: diff?.problems ?? [],
    error: (data.error as string | null) ?? null,
  };
  const source = data.sync_sources as unknown as { name: string } | null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 px-6 py-3.5 backdrop-blur-sm">
        <Link href="/imports" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2">
          <ArrowLeft size={13} /> Imports
        </Link>
      </header>
      <div className="max-w-3xl space-y-5 px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[16px] font-semibold text-ink">{source?.name ?? data.file_name ?? "Import"}</h1>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {new Date(data.created_at as string).toLocaleString()}
              {data.file_name ? ` · ${data.file_name}` : ""}
            </p>
          </div>
          <RunStatus status={run.status} />
        </div>
        {run.error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-700">{run.error}</p>}
        {run.status === "preview" && (
          <p className="text-[12px] text-ink-2">This preview was never confirmed, so nothing changed. Upload the file again to apply it.</p>
        )}
        <RunDiffView run={run} />
      </div>
    </div>
  );
}
