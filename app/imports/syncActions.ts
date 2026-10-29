"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { applyPreviewRun, type RunSummary } from "@/lib/sync/runs";
import { NOT_CERTIFIED_ERROR, recordCertification } from "@/lib/consent";

export type SyncActionResult = { ok: true; message?: string; run?: RunSummary } | { ok: false; error: string };

async function admin(): Promise<{ orgId: string; userId: string } | SyncActionResult> {
  try {
    const { orgId, userId } = await requireRole(ADMIN_ROLES);
    return { orgId, userId };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

function refresh() {
  revalidatePath("/imports");
  revalidatePath("/people");
  revalidatePath("/people/review");
  revalidatePath("/audiences");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

/** Confirms a preview: writes the changes it showed (recomputed against current data). */
export async function applySyncRun(runId: string, certified: boolean): Promise<SyncActionResult> {
  const gate = await admin();
  if ("ok" in gate) return gate;
  if (!certified) return { ok: false, error: NOT_CERTIFIED_ERROR };
  const supabase = await createSupabaseServerClient();
  try {
    const { data: runRow } = await supabase.from("sync_runs").select("source_id").eq("org_id", gate.orgId).eq("id", runId).maybeSingle();
    const cert = await recordCertification(supabase, { orgId: gate.orgId, userId: gate.userId, context: "file_import", runId, sourceId: (runRow?.source_id as string | undefined) ?? null });
    if (!cert.ok) return cert;
    const run = await applyPreviewRun(supabase, gate.orgId, runId);
    refresh();
    if (run.status === "failed") return { ok: false, error: run.error ?? "Import failed." };
    return { ok: true, run };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Import failed." };
  }
}

export async function discardSyncRun(runId: string): Promise<SyncActionResult> {
  const gate = await admin();
  if ("ok" in gate) return gate;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("sync_runs")
    .update({ status: "discarded", records: null })
    .eq("org_id", gate.orgId)
    .eq("id", runId)
    .eq("status", "preview");
  revalidatePath("/imports");
  return { ok: true };
}

export async function renameSyncSource(sourceId: string, name: string): Promise<SyncActionResult> {
  const gate = await admin();
  if ("ok" in gate) return gate;
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return { ok: false, error: "Name is required." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("sync_sources").update({ name: trimmed }).eq("org_id", gate.orgId).eq("id", sourceId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/**
 * Removes a list. Its people stay (they're part of the directory and message
 * history); they just stop being updated by it.
 */
export async function deleteSyncSource(sourceId: string): Promise<SyncActionResult> {
  const gate = await admin();
  if ("ok" in gate) return gate;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("sync_sources").delete().eq("org_id", gate.orgId).eq("id", sourceId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "List removed — its people stay in your directory." };
}

/** Org setting: new people from a sync go to "Review new contacts" (default) or straight in. */
export async function setNewContactsMode(mode: "review" | "auto"): Promise<SyncActionResult> {
  const gate = await admin();
  if ("ok" in gate) return gate;
  if (mode !== "review" && mode !== "auto") return { ok: false, error: "Unknown option." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ org_id: gate.orgId, key: "new_contacts_mode", value: mode }, { onConflict: "org_id,key" });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
