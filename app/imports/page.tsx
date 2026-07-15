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
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div>
          <h1 className="text-[13px] font-semibold text-[#0f0f0f]">Imports</h1>
          <p className="text-[11px] text-[#a1a1aa] mt-px">Upload a CSV to add or update contacts in bulk</p>
        </div>
      </header>

      <div className="px-6 py-6 max-w-2xl space-y-8">
        {/* Upload zone */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Upload CSV</h2>
          <ImportWidget />
        </section>

        {/* History */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">Import history</h2>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#e7e7e7] mb-4">
                <FileText size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-[#0f0f0f]">No imports yet</p>
              <p className="text-[12px] text-[#a1a1aa] mt-1">Completed imports will appear here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">File</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Added</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Skipped</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, i) => {
                    const isLast = i === records.length - 1;
                    return (
                      <tr
                        key={record.id}
                        className={`hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                      >
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fafafa] border border-[#f0f0f0]">
                              <FileText size={12} className="text-[#a1a1aa]" strokeWidth={1.5} />
                            </div>
                            <span className="text-[13px] font-medium text-[#0f0f0f]">{record.file_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-[13px] tabular-nums font-semibold text-[#0f0f0f]">
                            {record.imported_count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {record.failed_count != null && record.failed_count > 0 ? (
                            <span className="text-[13px] tabular-nums text-amber-600">
                              {record.failed_count.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-[#d4d4d8] text-[12px]">—</span>
                          )}
                        </td>
                        <td className="pl-3 pr-4 py-3 text-right">
                          <div className="text-right">
                            <div className="text-[12px] tabular-nums text-[#71717a]">{formatDate(record.created_at)}</div>
                            <div className="text-[10px] tabular-nums text-[#a1a1aa]">{formatTime(record.created_at)}</div>
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
