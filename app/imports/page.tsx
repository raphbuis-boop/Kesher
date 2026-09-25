export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { ImportWidget } from "./ImportWidget";
import { FileText } from "lucide-react";

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

export default async function ImportsPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const { data: imports } = await supabase
    .from("imports")
    .select("id, file_name, imported_count, failed_count, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const records = (imports ?? []) as ImportRecord[];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-6 py-3.5">
        <div>
          <h1 className="text-[13px] font-semibold text-text-primary">Imports</h1>
          <p className="text-[11px] text-text-subtle mt-px">Upload a CSV to add or update contacts in bulk</p>
        </div>
      </header>

      <div className="px-6 py-6 max-w-2xl space-y-8">
        {/* Upload zone */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Upload CSV</h2>
          <ImportWidget />
        </section>

        {/* History */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold text-text-subtle uppercase tracking-wider">Import history</h2>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border mb-4">
                <FileText size={18} className="text-text-faint" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-text-primary">No imports yet</p>
              <p className="text-[12px] text-text-subtle mt-1">Completed imports will appear here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle bg-background">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-text-subtle uppercase tracking-wide">File</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Added</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Skipped</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-text-subtle uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, i) => {
                    const isLast = i === records.length - 1;
                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-surface-hover transition-colors duration-100 ${!isLast ? "border-b border-border-subtle" : ""}`}
                      >
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background border border-border-subtle">
                              <FileText size={12} className="text-text-subtle" strokeWidth={1.5} />
                            </div>
                            <span className="text-[13px] font-medium text-text-primary">{record.file_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-[13px] tabular-nums font-semibold text-text-primary">
                            {record.imported_count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {record.failed_count != null && record.failed_count > 0 ? (
                            <span className="text-[13px] tabular-nums text-warning">
                              {record.failed_count.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-text-subtle text-[12px]">—</span>
                          )}
                        </td>
                        <td className="pl-3 pr-4 py-3 text-right">
                          <div className="text-right">
                            <div className="text-[12px] tabular-nums text-text-muted">{formatDate(record.created_at)}</div>
                            <div className="text-[10px] tabular-nums text-text-subtle">{formatTime(record.created_at)}</div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
