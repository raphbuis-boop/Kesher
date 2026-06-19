"use client";

import { useActionState, useRef, useState } from "react";
import {
  importPeople,
  type ImportActionState,
  type ParsedRow,
} from "./actions";

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);
    let hasValue = false;

    const row: Record<string, string> = {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      graduation_year: "",
      tags: "",
    };

    headers.forEach((header, idx) => {
      const val = (values[idx] ?? "").trim();
      if (Object.prototype.hasOwnProperty.call(row, header)) {
        row[header] = val;
      }
      if (val) hasValue = true;
    });

    if (hasValue) rows.push(row as ParsedRow);
  }

  return rows;
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  fileError,
  setFileError,
}: {
  onFile: (name: string, rows: ParsedRow[]) => void;
  fileError: string | null;
  setFileError: (e: string | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileError("Only .csv files are accepted.");
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      onFile(file.name, rows);
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) processFile(file);
        }}
        className={
          "cursor-pointer select-none rounded-lg border-2 border-dashed px-8 py-16 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 " +
          (isDragging
            ? "border-zinc-400 bg-zinc-50"
            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50")
        }
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
            <svg
              className="h-5 w-5 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900">
              Drop a CSV file here, or{" "}
              <span className="underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Accepted columns: first_name, last_name, email, phone,
              graduation_year, tags
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Tags column: pipe-separated values e.g.{" "}
              <span className="font-mono">Parent|Alumni|Donor</span>
            </p>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          // Reset so the same file can be re-selected after clearing
          e.target.value = "";
        }}
      />

      {fileError && (
        <p className="mt-3 text-sm text-red-600">{fileError}</p>
      )}
    </div>
  );
}

// ─── Import form (preview + submit) ──────────────────────────────────────────

const PREVIEW_LIMIT = 5;

const initialActionState: ImportActionState = {
  status: "idle",
  imported: 0,
  failed: 0,
  error: null,
};

function ImportForm({
  fileName,
  rows,
  onReset,
}: {
  fileName: string;
  rows: ParsedRow[];
  onReset: () => void;
}) {
  const [actionState, formAction, isPending] = useActionState(
    importPeople,
    initialActionState
  );

  const hasTags = rows.some((r) => r.tags);
  const previewRows = rows.slice(0, PREVIEW_LIMIT);
  const extra = rows.length - PREVIEW_LIMIT;

  // ── Result view ─────────────────────────────────────────────────────────────
  if (actionState.status === "success" || actionState.status === "error") {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-6 py-8 text-center">
        {actionState.status === "success" ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m4.5 12.75 6 6 9-13.5"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                Import complete
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {actionState.imported.toLocaleString()}{" "}
                {actionState.imported === 1 ? "person" : "people"} imported
                {actionState.failed > 0 && (
                  <span className="text-zinc-400">
                    {" · "}
                    {actionState.failed.toLocaleString()}{" "}
                    {actionState.failed === 1 ? "row" : "rows"} skipped
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onReset}
              className="mt-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Import Another File
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-red-600">
              {actionState.error ?? "Something went wrong."}
            </p>
            <button
              onClick={onReset}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Preview + submit ─────────────────────────────────────────────────────────
  return (
    <form action={formAction}>
      <input type="hidden" name="file_name" value={fileName} />
      <input type="hidden" name="rows" value={JSON.stringify(rows)} />

      {/* File header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-zinc-400"
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
          <span className="text-sm font-medium text-zinc-900">{fileName}</span>
        </div>
        <span className="text-sm text-zinc-400">
          {rows.length.toLocaleString()}{" "}
          {rows.length === 1 ? "row" : "rows"} found
        </span>
      </div>

      {/* Preview table */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 mb-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Email
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Phone
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Grad Year
              </th>
              {hasTags && (
                <th className="pl-3 pr-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Tags
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {previewRows.map((row, i) => (
              <tr key={i}>
                <td className="py-2.5 pl-4 pr-3">
                  <span className="font-medium text-zinc-900">
                    {[row.first_name, row.last_name].filter(Boolean).join(" ") || (
                      <span className="text-red-400">Missing name</span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {row.email ? (
                    <span className="text-zinc-600">{row.email}</span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {row.phone ? (
                    <span className="text-zinc-600">{row.phone}</span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {row.graduation_year ? (
                    <span className="tabular-nums text-zinc-600">
                      {row.graduation_year}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>
                {hasTags && (
                  <td className="pl-3 pr-4 py-2.5">
                    {row.tags ? (
                      <div className="flex flex-wrap gap-1">
                        {row.tags.split("|").map((t) => t.trim()).filter(Boolean).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {extra > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-2.5">
            <p className="text-xs text-zinc-400">
              Showing first {PREVIEW_LIMIT} of {rows.length.toLocaleString()} rows
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onReset}
          disabled={isPending}
          className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-50"
        >
          Choose a different file
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <svg
                className="h-3.5 w-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Importing…
            </>
          ) : (
            <>
              Import {rows.length.toLocaleString()}{" "}
              {rows.length === 1 ? "person" : "people"}
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Public widget ─────────────────────────────────────────────────────────────

export function ImportWidget() {
  const [file, setFile] = useState<{
    name: string;
    rows: ParsedRow[];
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFile(name: string, rows: ParsedRow[]) {
    if (rows.length === 0) {
      setFileError(
        "The file appears to be empty or has no valid data rows."
      );
      return;
    }
    setFile({ name, rows });
  }

  if (!file) {
    return (
      <DropZone
        onFile={handleFile}
        fileError={fileError}
        setFileError={setFileError}
      />
    );
  }

  return (
    <ImportForm
      // Remount when a new file is selected, resetting useActionState
      key={`${file.name}-${file.rows.length}`}
      fileName={file.name}
      rows={file.rows}
      onReset={() => {
        setFile(null);
        setFileError(null);
      }}
    />
  );
}
