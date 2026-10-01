export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { ImportWidget } from "./ImportWidget";
import { FileText } from "lucide-react";
import { Pagination, parsePage } from "@/app/components/ui/Pagination";

const PAGE_SIZE = 25;

type ImportRecord = {
  id: string;
  file_name: string;
  imported_count: number;
  failed_count: number | null;
  created_at: string;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = parsePage((await searchParams).page);
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const { data: imports, count } = await supabase
    .from("imports")
    .select("id, file_name, imported_count, failed_count, created_at", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const records = (imports ?? []) as ImportRecord[];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div>
          <h1 className="text-[13px] font-semibold text-ink">Imports</h1>
          <p className="text-[11px] text-ink-3 mt-px">Upload a CSV to add or update contacts in bulk</p>
        </div>
      </header>

      <div className="px-6 py-6 max-w-2xl space-y-8">
        {/* Upload zone */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Upload CSV</h2>
          <ImportWidget />
        </section>

        {/* History */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Import history</h2>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-line mb-4">
                <FileText size={18} className="text-line-strong" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-ink">No imports yet</p>
              <p className="text-[12px] text-ink-3 mt-1">Completed imports will appear here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-muted-2 bg-canvas">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-ink-3 uppercase tracking-wide">File</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Added</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Skipped</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-ink-3 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, i) => {
                    const isLast = i === records.length - 1;
                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-canvas transition-colors duration-100 ${!isLast ? "border-b border-muted" : ""}`}
                      >
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-canvas border border-muted-2">
                              <FileText size={12} className="text-ink-3" strokeWidth={1.5} />
                            </div>
                            <span className="text-[13px] font-medium text-ink">{record.file_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-[13px] tabular-nums font-semibold text-ink">
                            {record.imported_count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {record.failed_count != null && record.failed_count > 0 ? (
                            <span className="text-[13px] tabular-nums text-amber-600">
                              {record.failed_count.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-line-strong text-[12px]">—</span>
                          )}
                        </td>
                        <td className="pl-3 pr-4 py-3 text-right">
                          <div className="text-right">
                            <div className="text-[12px] tabular-nums text-ink-2">{formatDate(record.created_at)}</div>
                            <div className="text-[10px] tabular-nums text-ink-3">{formatTime(record.created_at)}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={count ?? records.length}
                buildHref={(p) => (p === 1 ? "/imports" : `/imports?page=${p}`)}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
