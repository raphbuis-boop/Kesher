"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { deleteGoogleConnection, fetchSheetTable, getSpreadsheetInfo, googleConfigError, parseSheetUrl, type SpreadsheetInfo } from "@/lib/google";
import { buildBatch, suggestMapping, type ColumnMapping } from "@/lib/sync/mapping";
import { createPreviewRun, getSource, runSourceNow, type RunSummary } from "@/lib/sync/runs";
import { fetchSheetBatch, type SheetConfig } from "@/lib/sync/sheets";
import type { SyncSourceRow } from "@/lib/sync/engine";
import { getCustomFieldDefs } from "@/lib/customFields";
import { NOT_CERTIFIED_ERROR, recordCertification } from "@/lib/consent";

type Fail = { ok: false; error: string };

async function gate(): Promise<{ orgId: string; userId: string } | Fail> {
  try {
    const { orgId, userId } = await requireRole(ADMIN_ROLES);
    const configError = googleConfigError();
    if (configError) return { ok: false, error: configError };
    return { orgId, userId };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

const refresh = () => {
  revalidatePath("/settings");
  revalidatePath("/imports");
  revalidatePath("/people");
  revalidatePath("/people/review");
  revalidatePath("/audiences");
};

/** Step 1: paste a link → spreadsheet title and its tabs. */
export async function inspectSheet(url: string): Promise<({ ok: true; spreadsheetId: string; gid: number | null } & SpreadsheetInfo) | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  const parsed = parseSheetUrl(url);
  if (!parsed) return { ok: false, error: "That doesn't look like a Google Sheets link." };
  try {
    const info = await getSpreadsheetInfo(g.orgId, parsed.spreadsheetId);
    return { ok: true, spreadsheetId: parsed.spreadsheetId, gid: parsed.gid, ...info };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't open that sheet." };
  }
}

export type SheetSample = {
  headers: string[];
  sampleRows: string[][];
  rowCount: number;
  mapping: ColumnMapping;
};

/** Step 2: pick a tab → its columns, a few sample rows and a suggested mapping (or the saved one). */
export async function loadSheetTab(spreadsheetId: string, tabTitle: string, sourceId?: string): Promise<({ ok: true } & SheetSample) | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  try {
    const supabase = await createSupabaseServerClient();
    const [table, defs, saved] = await Promise.all([
      fetchSheetTable(g.orgId, spreadsheetId, tabTitle),
      getCustomFieldDefs(supabase, g.orgId),
      sourceId ? getSource(supabase, g.orgId, sourceId) : Promise.resolve(null),
    ]);
    if (table.headers.length === 0 || table.rows.length === 0) return { ok: false, error: `The "${tabTitle}" tab has no data.` };
    const savedMapping = saved?.mapping as unknown as ColumnMapping | undefined;
    const mapping =
      savedMapping && Object.keys(savedMapping.columns ?? {}).length > 0
        ? savedMapping
        : suggestMapping(table.headers, defs.map((d) => ({ key: d.key, label: d.label })));
    return { ok: true, headers: table.headers, sampleRows: table.rows.slice(0, 5), rowCount: table.rows.length, mapping };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't read that tab." };
  }
}

/**
 * Step 3: save the sheet + mapping and return the first diff for review.
 * (Later syncs — Sync now and the nightly cron — apply directly, with the
 * same rules and the org's New contacts setting.)
 */
export async function saveSheetAndPreview(input: {
  sourceId?: string;
  name: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  tabTitle: string;
  mapping: ColumnMapping;
  /** The SMS consent certification checkbox (required: a connected sheet syncs nightly) */
  certified: boolean;
}): Promise<{ ok: true; sourceId: string; run: RunSummary } | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  if (!input.certified) return { ok: false, error: NOT_CERTIFIED_ERROR };
  const supabase = await createSupabaseServerClient();
  const config: SheetConfig = { spreadsheetId: input.spreadsheetId, spreadsheetTitle: input.spreadsheetTitle, tabTitle: input.tabTitle };
  const name = input.name.trim().slice(0, 120) || input.spreadsheetTitle;

  try {
    const table = await fetchSheetTable(g.orgId, input.spreadsheetId, input.tabTitle);
    const mapping: ColumnMapping = {
      mode: input.mapping.mode === "person" ? "person" : "student",
      columns: Object.fromEntries(
        Object.entries(input.mapping.columns ?? {}).filter(([h, t]) => table.headers.includes(h) && typeof t === "string" && t !== "ignore")
      ),
      defaults: input.mapping.defaults ?? {},
    };

    let source: SyncSourceRow | null;
    if (input.sourceId) {
      source = await getSource(supabase, g.orgId, input.sourceId);
      if (!source || source.kind !== "google_sheets") return { ok: false, error: "That sheet no longer exists." };
      await supabase
        .from("sync_sources")
        .update({ name, mapping, config, updated_at: new Date().toISOString() })
        .eq("org_id", g.orgId)
        .eq("id", source.id);
      source = { ...source, name, mapping: mapping as unknown as Record<string, unknown>, config: config as unknown as Record<string, unknown> };
    } else {
      const { data, error } = await supabase
        .from("sync_sources")
        .insert({ org_id: g.orgId, kind: "google_sheets", name, mapping, config, auto_sync: true, created_by: g.userId })
        .select("id, org_id, kind, name, mapping, config, auto_sync")
        .single();
      if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save the sheet." };
      source = data as SyncSourceRow;
    }

    const cert = await recordCertification(supabase, { orgId: g.orgId, userId: g.userId, context: "sheet_connect", sourceId: source.id });
    if (!cert.ok) return cert;
    await supabase.from("sync_sources").update({ consent_certified_at: new Date().toISOString(), consent_certified_by: g.userId }).eq("org_id", g.orgId).eq("id", source.id);

    const batch = buildBatch(table, mapping);
    const run = await createPreviewRun(supabase, g.orgId, g.userId, source, batch, `${config.spreadsheetTitle} → ${config.tabTitle}`);
    refresh();
    return { ok: true, sourceId: source.id, run };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't preview that sheet." };
  }
}

/** "Sync now": fetch the sheet and apply it with the same engine and rules as an upload. */
export async function syncSheetNow(sourceId: string, certified: boolean): Promise<{ ok: true; run: RunSummary } | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  if (!certified) return { ok: false, error: NOT_CERTIFIED_ERROR };
  const supabase = await createSupabaseServerClient();
  const source = await getSource(supabase, g.orgId, sourceId);
  if (!source || source.kind !== "google_sheets") return { ok: false, error: "That sheet no longer exists." };
  const cert = await recordCertification(supabase, { orgId: g.orgId, userId: g.userId, context: "sheet_sync", sourceId: source.id });
  if (!cert.ok) return cert;
  try {
    const run = await runSourceNow(supabase, g.orgId, source, "manual", g.userId, () => fetchSheetBatch(g.orgId, source));
    refresh();
    if (run.status === "failed") return { ok: false, error: run.error ?? "Sync failed." };
    return { ok: true, run };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function setSheetAutoSync(sourceId: string, on: boolean, certified = false): Promise<{ ok: true } | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  const supabase = await createSupabaseServerClient();
  // Turning the nightly sync on is a standing import: it needs the certification
  if (on) {
    if (!certified) return { ok: false, error: NOT_CERTIFIED_ERROR };
    const cert = await recordCertification(supabase, { orgId: g.orgId, userId: g.userId, context: "sheet_auto_sync", sourceId });
    if (!cert.ok) return cert;
  }
  const { error } = await supabase
    .from("sync_sources")
    .update({ auto_sync: on, status: "active", updated_at: new Date().toISOString(), ...(on ? { consent_certified_at: new Date().toISOString(), consent_certified_by: g.userId } : {}) })
    .eq("org_id", g.orgId)
    .eq("id", sourceId)
    .eq("kind", "google_sheets");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function disconnectGoogle(): Promise<{ ok: true } | Fail> {
  let orgId: string;
  try {
    ({ orgId } = await requireRole(ADMIN_ROLES));
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
  const supabase = await createSupabaseServerClient();
  // Sheets stop syncing; their people stay
  await supabase.from("sync_sources").update({ auto_sync: false }).eq("org_id", orgId).eq("kind", "google_sheets");
  await deleteGoogleConnection(orgId);
  refresh();
  return { ok: true };
}
