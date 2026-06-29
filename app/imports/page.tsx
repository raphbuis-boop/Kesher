export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ImportWidget } from "./ImportWidget";

type ImportRecord = {
  id: string;
  file_name: string;
  imported_count: number;
  failed_count: number | null;
  created_at: string;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ImportsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: imports } = await supabase
    .from("imports")
    .select("id, file_name, imported_count, failed_count, created_at")
    .order("created_at", { ascending: false });

  const records = (imports ?? []) as ImportRecord[];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900">Imports</h1>
          <p className="mt-0.5 text-xs text-zinc-400">Upload a CSV to add or update contacts in bulk</p>
        </div>
      </header>

      <div className="px-6 py-6 space-y-8 max-w-3xl">
        {/* Upload */}
        <section>
          <h2 className="mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Upload CSV</h2>
          <ImportWidget />
        </section>

        {/* History */}
        <section>
          <h2 className="mb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Import history</h2>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-14 text-center">
              <p className="text-sm font-medium text-zinc-500">No imports yet</p>
              <p className="mt-1 text-xs text-zinc-400">Completed imports will appear here.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-zinc-400">File</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-400">Imported</th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-400">Skipped</th>
                    <th className="pl-3 pr-4 py-2.5 text-right text-xs font-medium text-zinc-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-3.5 w-3.5 shrink-0 text-zinc-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                          <span className="text-sm font-medium text-zinc-900">{record.file_name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-sm tabular-nums font-medium text-zinc-900">
                          {record.imported_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {record.failed_count != null && record.failed_count > 0 ? (
                          <span className="text-sm tabular-nums text-amber-600">
                            {record.failed_count.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="pl-3 pr-4 py-3 text-right">
                        <span className="text-xs tabular-nums text-zinc-400">{formatDate(record.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
