export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { getCustomFieldDefs } from "@/lib/customFields";
import { Pagination, parsePage } from "@/app/components/ui/Pagination";
import type { ColumnMapping } from "@/lib/sync/mapping";
import type { SyncStats } from "@/lib/sync/engine";
import { SyncImport } from "./SyncImport";
import { SourceActions } from "./SourceActions";
import { RunStatus } from "./RunStatus";
import { ArrowRight, FileText, RefreshCw, Sheet } from "lucide-react";

const PAGE_SIZE = 25;

type SourceRow = {
  id: string;
  kind: string;
  name: string;
  mapping: ColumnMapping | null;
  last_run_at: string | null;
  last_error: string | null;
  auto_sync: boolean;
};

type RunRow = {
  id: string;
  trigger: "upload" | "manual" | "cron";
  status: string;
  file_name: string | null;
  stats: Partial<SyncStats>;
  error: string | null;
  created_at: string;
  sync_sources: { name: string; kind: string } | null;
};

type LegacyImport = { id: string; file_name: string; imported_count: number; failed_count: number | null; created_at: string };

const TRIGGER: Record<RunRow["trigger"], string> = { upload: "File upload", manual: "Sync now", cron: "Nightly sync" };

function when(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page);
  const supabase = await createSupabaseServerClient();
  const { orgId, role } = await getMembership();

  if (!isAdminRole(role)) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="sticky top-0 z-10 border-b border-line bg-card/95 px-6 py-3.5 backdrop-blur-sm">
          <h1 className="text-[13px] font-semibold text-ink">Imports</h1>
        </header>
        <div className="px-6 py-10 text-[13px] text-ink-2">Only your school&apos;s owner or admins can import and sync families.</div>
      </div>
    );
  }

  const [sourcesRes, runsRes, legacyRes, defs] = await Promise.all([
    supabase
      .from("sync_sources")
      .select("id, kind, name, mapping, last_run_at, last_error, auto_sync")
      .eq("org_id", orgId)
      .order("created_at"),
    supabase
      .from("sync_runs")
      .select("id, trigger, status, file_name, stats, error, created_at, sync_sources ( name, kind )", { count: "exact" })
      .eq("org_id", orgId)
      .neq("status", "discarded")
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, failed_count, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    getCustomFieldDefs(supabase, orgId),
  ]);

  const sources = (sourcesRes.data ?? []) as SourceRow[];
  const runs = (runsRes.data ?? []) as unknown as RunRow[];
  const legacy = (legacyRes.data ?? []) as LegacyImport[];
  const fileSources = sources.filter((s) => s.kind === "csv");

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 px-6 py-3.5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[13px] font-semibold text-ink">Imports &amp; sync</h1>
            <p className="mt-px text-[11px] text-ink-3">Keep Kesher matched to your school&apos;s family list — nobody gets typed in twice</p>
          </div>
          <Link href="/settings#data" className="btn btn-secondary btn-sm">
            <Sheet size={12} /> Google Sheets &amp; SIS
          </Link>
        </div>
      </header>

      <div className="max-w-3xl space-y-8 px-6 py-6">
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Upload a file</h2>
          <SyncImport
            sources={fileSources.map((s) => ({ id: s.id, name: s.name, mapping: s.mapping && Object.keys(s.mapping.columns ?? {}).length ? s.mapping : null }))}
            customFields={defs.map((d) => ({ key: d.key, label: d.label }))}
          />
        </section>

        {sources.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Your lists</h2>
            <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
              <ul className="divide-y divide-muted">
                {sources.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    {s.kind === "google_sheets" ? (
                      <Sheet size={14} className="shrink-0 text-emerald-600" />
                    ) : (
                      <FileText size={14} className="shrink-0 text-ink-3" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{s.name}</p>
                      <p className="text-[11px] text-ink-3">
                        {s.kind === "google_sheets" ? "Google Sheet" : "File upload"}
                        {s.auto_sync ? " · syncs nightly" : ""}
                        {s.last_run_at ? ` · last run ${when(s.last_run_at)}` : " · never run"}
                        {s.last_error && <span className="text-red-600"> · {s.last_error}</span>}
                      </p>
                    </div>
                    <SourceActions id={s.id} name={s.name} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">History</h2>
          {runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-12 text-center">
              <RefreshCw size={16} className="mb-3 text-line-strong" />
              <p className="text-[12px] text-ink-3">Every import and sync shows up here with what it changed.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-muted-2 bg-canvas text-left text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                    <th className="py-2.5 pl-4 pr-3">List</th>
                    <th className="px-3 py-2.5">Result</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="py-2.5 pl-3 pr-4 text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b border-muted last:border-0 hover:bg-canvas">
                      <td className="py-3 pl-4 pr-3">
                        <Link href={`/imports/runs/${r.id}`} className="text-[13px] font-medium text-ink hover:text-ink-2">
                          {r.sync_sources?.name ?? r.file_name ?? "Import"}
                        </Link>
                        <p className="text-[11px] text-ink-3">{TRIGGER[r.trigger]}{r.file_name && r.trigger === "upload" ? ` · ${r.file_name}` : ""}</p>
                      </td>
                      <td className="px-3 py-3 text-[12px] tabular-nums text-ink-2">
                        {r.status === "failed" ? (
                          <span className="text-red-600">{r.error}</span>
                        ) : (
                          <>
                            {r.stats.new ?? 0} new · {(r.stats.updated ?? 0) + (r.stats.restored ?? 0)} updated
                            {r.stats.archived ? ` · ${r.stats.archived} archived` : ""}
                            {r.stats.queued ? ` · ${r.stats.queued} to review` : ""}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3"><RunStatus status={r.status} /></td>
                      <td className="py-3 pl-3 pr-4 text-right text-[11px] tabular-nums text-ink-3">
                        {when(r.created_at)}
                        <Link href={`/imports/runs/${r.id}`} className="ml-2 inline-flex text-ink-3 hover:text-ink"><ArrowRight size={11} /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pageSize={PAGE_SIZE} total={runsRes.count ?? runs.length} buildHref={(p) => (p === 1 ? "/imports" : `/imports?page=${p}`)} />
            </div>
          )}
        </section>

        {legacy.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Earlier imports</h2>
            <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
              <ul className="divide-y divide-muted">
                {legacy.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                    <FileText size={13} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate text-ink">{i.file_name}</span>
                    <span className="tabular-nums text-ink-2">{i.imported_count} added</span>
                    <span className="tabular-nums text-ink-3">{when(i.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
