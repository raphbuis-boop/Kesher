/**
 * Turning files into a { headers, rows } table. Runs in the browser (uploads
 * are read locally and never stored) and on the server (Google Sheets).
 */

import type { TableData } from "./mapping";

/** RFC 4180-ish CSV: quoted fields, "" escapes, newlines inside quotes, CRLF, BOM; , ; or tab. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? src.length : src.search(/\r?\n/));
  const delim = [",", ";", "\t"].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * First non-empty row is the header row. Blank/duplicate headers get a
 * position-based name so every column stays mappable.
 */
export function toTable(raw: string[][]): TableData {
  const start = raw.findIndex((r) => r.some((c) => String(c ?? "").trim()));
  if (start === -1) return { headers: [], rows: [] };
  const seen = new Map<string, number>();
  const headers = raw[start].map((h, i) => {
    const base = String(h ?? "").trim() || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  const rows = raw
    .slice(start + 1)
    .filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((r) => headers.map((_, i) => String(r[i] ?? "").trim()));
  return { headers, rows };
}

/** Excel cell → string. Dates become YYYY-MM-DD; whole numbers lose the ".0". */
export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}
