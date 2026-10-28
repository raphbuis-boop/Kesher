import { NextResponse } from "next/server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildBatch, type ColumnMapping } from "@/lib/sync/mapping";
import { createPreviewRun, getSource } from "@/lib/sync/runs";
import type { SyncSourceRow } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 20000;
const MAX_COLS = 200;

type Body = {
  sourceId?: string;
  sourceName?: string;
  mapping?: ColumnMapping;
  fileName?: string;
  headers?: string[];
  rows?: string[][];
};

/**
 * POST /api/sync/preview — owner/admin only. Saves the column mapping for the
 * list (creating the list the first time), then returns the diff this file
 * would make: new / updated / unchanged / missing / problems. Nothing in the
 * directory changes until the admin confirms (applySyncRun).
 */
export async function POST(req: Request) {
  let orgId: string;
  let userId: string;
  try {
    ({ orgId, userId } = await requireRole(ADMIN_ROLES));
  } catch (err) {
    if (err instanceof PermissionError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { headers, rows, mapping } = body;
  if (!Array.isArray(headers) || !Array.isArray(rows) || !mapping || typeof mapping.columns !== "object") {
    return NextResponse.json({ error: "Missing file data or mapping." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS || headers.length > MAX_COLS) {
    return NextResponse.json({ error: `Files are limited to ${MAX_ROWS.toLocaleString()} rows and ${MAX_COLS} columns.` }, { status: 413 });
  }
  if (mapping.mode !== "student" && mapping.mode !== "person") {
    return NextResponse.json({ error: "Pick how the file is laid out." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  let source: SyncSourceRow | null;
  const cleanMapping: ColumnMapping = {
    mode: mapping.mode,
    columns: Object.fromEntries(
      Object.entries(mapping.columns).filter(([h, t]) => headers.includes(h) && typeof t === "string" && t !== "ignore")
    ),
    defaults: mapping.defaults ?? {},
  };

  if (body.sourceId) {
    source = await getSource(supabase, orgId, body.sourceId);
    if (!source) return NextResponse.json({ error: "That list no longer exists." }, { status: 404 });
    await supabase
      .from("sync_sources")
      .update({ mapping: cleanMapping, updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", source.id);
  } else {
    const name = (body.sourceName ?? body.fileName ?? "").trim().slice(0, 120) || "Imported list";
    const { data, error } = await supabase
      .from("sync_sources")
      .insert({ org_id: orgId, kind: "csv", name, mapping: cleanMapping, created_by: userId })
      .select("id, org_id, kind, name, mapping, config, auto_sync")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not save the list." }, { status: 500 });
    source = data as SyncSourceRow;
  }

  try {
    const batch = buildBatch(
      { headers, rows: rows.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? "")) : [])) },
      cleanMapping
    );
    const run = await createPreviewRun(supabase, orgId, userId, source, batch, body.fileName?.slice(0, 200) ?? null);
    return NextResponse.json({ sourceId: source.id, run });
  } catch (err) {
    return NextResponse.json({ sourceId: source.id, error: err instanceof Error ? err.message : "Preview failed." }, { status: 422 });
  }
}
