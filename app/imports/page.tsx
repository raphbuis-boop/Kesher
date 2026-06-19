export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { ImportWidget } from "./ImportWidget";

type ImportRecord = {
  id: string;
  file_name: string;
  imported_count: number;
  failed_count: number | null;
  created_at: string;
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ImportsPage() {
  const { data: imports } = await supabase
    .from("imports")
    .select("id, file_name, imported_count, failed_count, created_at")
    .order("created_at", { ascending: false });

  const records = (imports ?? []) as ImportRecord[];

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="border-b border-zinc-200">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Imports
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Upload a CSV file to add people in bulk
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-10">
        {/* Upload section */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">
            Upload CSV
          </h2>
          <ImportWidget />
        </section>

        {/* Import history */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">
            Import History
          </h2>

          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center">
              <p className="text-sm font-medium text-zinc-900">
                No imports yet
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Completed imports will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      File
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Imported
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Skipped
                    </th>
                    <th className="pl-3 pr-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className="transition-colors hover:bg-zinc-50"
                    >
                      <td className="py-3.5 pl-4 pr-3">
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                            />
                          </svg>
                          <span className="font-medium text-zinc-900">
                            {record.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="tabular-nums font-medium text-zinc-900">
                          {record.imported_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        {record.failed_count != null && record.failed_count > 0 ? (
                          <span className="tabular-nums text-zinc-500">
                            {record.failed_count.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="pl-3 pr-4 py-3.5">
                        <span className="tabular-nums text-zinc-400">
                          {formatDate(record.created_at)}
                        </span>
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
