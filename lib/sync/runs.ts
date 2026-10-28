/**
 * Sync runs: the preview → confirm flow for file imports, and the one-step
 * run for "Sync now" / the nightly cron. Every run is saved to sync_runs
 * (the import/sync history).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applySync, compactDiff, computeDiff, getNewContactsMode, type SyncDiff, type SyncSourceRow, type SyncStats } from "./engine";
import type { SyncBatch } from "./types";

export type RunTrigger = "upload" | "manual" | "cron";

export type RunSummary = {
  id: string;
  status: "preview" | "applying" | "applied" | "failed" | "discarded";
  stats: Partial<SyncStats>;
  warnings: string[];
  diff: SyncDiff | null;
  problems: SyncBatch["problems"];
  error: string | null;
};

const SOURCE_COLS = "id, org_id, kind, name, mapping, config, auto_sync";

export async function getSource(supabase: SupabaseClient, orgId: string, sourceId: string): Promise<SyncSourceRow | null> {
  const { data } = await supabase.from("sync_sources").select(SOURCE_COLS).eq("org_id", orgId).eq("id", sourceId).maybeSingle();
  return (data as SyncSourceRow | null) ?? null;
}

function warningsFor(batch: SyncBatch, diff: SyncDiff): string[] {
  const w = [...batch.warnings];
  if (diff.missingSkipped) {
    w.push(
      "More than half of the people from this source are missing from it this time, so nobody was marked missing. If people really left, run the sync again after checking the source."
    );
  }
  return w;
}

/** Computes the diff and saves it as a preview run the admin can confirm. */
export async function createPreviewRun(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
  source: SyncSourceRow,
  batch: SyncBatch,
  fileName: string | null
): Promise<RunSummary> {
  if (batch.people.length === 0) throw new Error("No people found in this file. Check the column mapping.");
  const mode = await getNewContactsMode(supabase, orgId);
  const { diff } = await computeDiff(supabase, orgId, source.id, batch, mode);
  const warnings = warningsFor(batch, diff);

  // Older previews of this source can't be applied anymore
  await supabase
    .from("sync_runs")
    .update({ status: "discarded" })
    .eq("org_id", orgId)
    .eq("source_id", source.id)
    .eq("status", "preview");

  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      org_id: orgId,
      source_id: source.id,
      trigger: "upload",
      status: "preview",
      file_name: fileName,
      stats: diff.stats,
      diff: { ...compactDiff(diff), problems: batch.problems.slice(0, 500) },
      records: batch,
      warnings,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save the preview.");

  return { id: data.id as string, status: "preview", stats: diff.stats, warnings, diff, problems: batch.problems, error: null };
}

async function finishRun(
  supabase: SupabaseClient,
  orgId: string,
  source: SyncSourceRow,
  runId: string,
  batch: SyncBatch
): Promise<RunSummary> {
  try {
    const mode = await getNewContactsMode(supabase, orgId);
    const result = await applySync(supabase, orgId, source, batch, mode);
    const warnings = [...warningsFor(batch, result.diff), ...result.problems.slice(0, 50)];
    const now = new Date().toISOString();
    await supabase
      .from("sync_runs")
      .update({
        status: "applied",
        stats: result.stats,
        diff: { ...compactDiff(result.diff), problems: batch.problems.slice(0, 500) },
        records: null, // the batch isn't needed once applied
        warnings,
        applied_at: now,
      })
      .eq("org_id", orgId)
      .eq("id", runId);
    await supabase
      .from("sync_sources")
      .update({ last_run_at: now, last_run_id: runId, last_error: null, status: "active", updated_at: now })
      .eq("org_id", orgId)
      .eq("id", source.id);
    return { id: runId, status: "applied", stats: result.stats, warnings, diff: result.diff, problems: batch.problems, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sync] run ${runId} failed:`, message);
    await supabase.from("sync_runs").update({ status: "failed", error: message }).eq("org_id", orgId).eq("id", runId);
    await supabase
      .from("sync_sources")
      .update({ last_run_at: new Date().toISOString(), last_run_id: runId, last_error: message })
      .eq("org_id", orgId)
      .eq("id", source.id);
    return { id: runId, status: "failed", stats: {}, warnings: [], diff: null, problems: batch.problems, error: message };
  }
}

/**
 * Applies a preview run. The status flip preview → applying only succeeds
 * once, so a double click (or two admins) can't apply the same run twice.
 */
export async function applyPreviewRun(supabase: SupabaseClient, orgId: string, runId: string): Promise<RunSummary> {
  const { data: claimed } = await supabase
    .from("sync_runs")
    .update({ status: "applying" })
    .eq("org_id", orgId)
    .eq("id", runId)
    .eq("status", "preview")
    .select("id, source_id, records")
    .maybeSingle();
  if (!claimed) throw new Error("This preview was already applied or replaced by a newer one.");

  const source = await getSource(supabase, orgId, claimed.source_id as string);
  if (!source) throw new Error("Sync source not found.");
  return finishRun(supabase, orgId, source, runId, claimed.records as SyncBatch);
}

/** "Sync now" and the nightly cron: fetch → apply in one step, same rules as a file import. */
export async function runSourceNow(
  supabase: SupabaseClient,
  orgId: string,
  source: SyncSourceRow,
  trigger: RunTrigger,
  userId: string | null,
  fetchBatch: () => Promise<SyncBatch>
): Promise<RunSummary> {
  const { data: run, error } = await supabase
    .from("sync_runs")
    .insert({ org_id: orgId, source_id: source.id, trigger, status: "applying", created_by: userId, file_name: source.name })
    .select("id")
    .single();
  if (error || !run) throw new Error(error?.message ?? "Could not start the sync.");

  let batch: SyncBatch;
  try {
    batch = await fetchBatch();
    if (batch.people.length === 0) throw new Error("The source returned no people — nothing was changed.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("sync_runs").update({ status: "failed", error: message }).eq("org_id", orgId).eq("id", run.id);
    await supabase
      .from("sync_sources")
      .update({ last_run_at: new Date().toISOString(), last_run_id: run.id, last_error: message, status: "error" })
      .eq("org_id", orgId)
      .eq("id", source.id);
    return { id: run.id as string, status: "failed", stats: {}, warnings: [], diff: null, problems: [], error: message };
  }
  return finishRun(supabase, orgId, source, run.id as string, batch);
}
