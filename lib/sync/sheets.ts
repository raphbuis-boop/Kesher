/**
 * Google Sheet → sync batch. Same mapping and engine as a file import; the
 * only difference is where the table comes from.
 */

import { fetchSheetTable } from "@/lib/google";
import { buildBatch, type ColumnMapping } from "./mapping";
import type { SyncSourceRow } from "./engine";
import type { SyncBatch } from "./types";

export type SheetConfig = { spreadsheetId: string; spreadsheetTitle: string; tabTitle: string };

export function sheetConfig(source: Pick<SyncSourceRow, "config">): SheetConfig {
  const c = source.config as Partial<SheetConfig>;
  if (!c.spreadsheetId || !c.tabTitle) throw new Error("This sheet isn't fully set up. Remove it and add it again.");
  return { spreadsheetId: c.spreadsheetId, spreadsheetTitle: c.spreadsheetTitle ?? "Spreadsheet", tabTitle: c.tabTitle };
}

export async function fetchSheetBatch(orgId: string, source: Pick<SyncSourceRow, "config" | "mapping">): Promise<SyncBatch> {
  const cfg = sheetConfig(source);
  const mapping = source.mapping as unknown as ColumnMapping;
  if (!mapping?.columns || Object.keys(mapping.columns).length === 0) throw new Error("No columns are mapped for this sheet yet.");
  const table = await fetchSheetTable(orgId, cfg.spreadsheetId, cfg.tabTitle);
  if (table.headers.length === 0) throw new Error(`The "${cfg.tabTitle}" tab is empty.`);
  // A renamed header silently stops a column from syncing — say so instead
  const missing = Object.keys(mapping.columns).filter((h) => !table.headers.includes(h));
  const batch = buildBatch(table, mapping);
  if (missing.length > 0) {
    batch.warnings.push(
      `These mapped columns weren't found in the sheet and were skipped: ${missing.join(", ")}. If you renamed a column, edit the sheet's column mapping.`
    );
  }
  return batch;
}
