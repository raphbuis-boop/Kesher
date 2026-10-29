"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { chunk } from "@/lib/supabase-paging";
import { computeRolloverPlan, planToChanges, schoolYearLabel, type RolloverChange, type RolloverPlan } from "@/lib/rollover";

type Fail = { ok: false; error: string };

async function gate(): Promise<{ orgId: string; userId: string } | Fail> {
  try {
    const { orgId, userId } = await requireRole(ADMIN_ROLES);
    return { orgId, userId };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Trimmed plan for the browser: full lists are capped so a 3,000-student school stays light. */
export type PlanView = Omit<RolloverPlan, "promotions" | "graduates" | "parents" | "skipped"> & {
  promotionCount: number;
  graduateCount: number;
  parentCount: number;
  graduates: { id: string; name: string; from: string }[];
  parents: { id: string; name: string }[];
  skipped: { id: string; name: string; reason: string }[];
  skippedCount: number;
};

function view(plan: RolloverPlan): PlanView {
  return {
    topGrade: plan.topGrade,
    archiveParents: plan.archiveParents,
    byGrade: plan.byGrade,
    syncedStudents: plan.syncedStudents,
    hash: plan.hash,
    promotionCount: plan.promotions.length,
    graduateCount: plan.graduates.length,
    parentCount: plan.parents.length,
    graduates: plan.graduates.slice(0, 200),
    parents: plan.parents.slice(0, 200),
    skipped: plan.skipped.slice(0, 200),
    skippedCount: plan.skipped.length,
  };
}

export async function previewRollover(topGrade: string, archiveParents: boolean): Promise<{ ok: true; plan: PlanView } | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  const supabase = await createSupabaseServerClient();
  try {
    return { ok: true, plan: view(await computeRolloverPlan(supabase, g.orgId, topGrade, archiveParents)) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't build the preview." };
  }
}

const RECENT_DAYS = 200;

export async function applyRollover(input: {
  topGrade: string;
  archiveParents: boolean;
  hash: string;
  /** Required when a rollover was already applied recently. */
  confirmAgain?: boolean;
}): Promise<{ ok: true; message: string } | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  const supabase = await createSupabaseServerClient();

  const plan = await computeRolloverPlan(supabase, g.orgId, input.topGrade, input.archiveParents).catch(() => null);
  if (!plan) return { ok: false, error: "Couldn't build the plan. Pick the last grade and preview again." };
  if (plan.hash !== input.hash) return { ok: false, error: "Your directory changed since the preview. Preview again to see the current plan." };
  if (plan.promotions.length + plan.graduates.length === 0) return { ok: false, error: "There are no students to promote." };

  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString();
  const { data: recent } = await supabase
    .from("rollover_runs")
    .select("school_year")
    .eq("org_id", g.orgId)
    .eq("status", "applied")
    .gte("created_at", since)
    .limit(1);
  if ((recent?.length ?? 0) > 0 && !input.confirmAgain) {
    return { ok: false, error: `A rollover for ${recent![0].school_year} was already applied recently. Applying again would promote everyone a second time.` };
  }

  const changes = planToChanges(plan);
  const { data: run, error: runError } = await supabase
    .from("rollover_runs")
    .insert({
      org_id: g.orgId,
      school_year: schoolYearLabel(),
      top_grade: plan.topGrade,
      archive_parents: plan.archiveParents,
      promoted_count: plan.promotions.length,
      graduated_count: plan.graduates.length,
      parents_archived: plan.parents.length,
      changes,
      created_by: g.userId,
    })
    .select("id")
    .single();
  if (runError || !run) return { ok: false, error: runError?.message ?? "Couldn't start the rollover." };

  const now = new Date().toISOString();
  try {
    // Promotions, grouped by the new grade so each is a few bulk updates
    const byTo = new Map<string, string[]>();
    for (const p of plan.promotions) byTo.set(p.to, [...(byTo.get(p.to) ?? []), p.id]);
    for (const [to, ids] of byTo) {
      for (const part of chunk(ids, 150)) {
        const { error } = await supabase.from("people").update({ grade: to, updated_at: now }).eq("org_id", g.orgId).in("id", part);
        if (error) throw new Error(error.message);
      }
    }
    const archiveIds = [...plan.graduates.map((x) => x.id), ...plan.parents.map((x) => x.id)];
    for (const part of chunk(archiveIds, 150)) {
      const { error } = await supabase
        .from("people")
        .update({ status: "archived", archived_at: now, updated_at: now })
        .eq("org_id", g.orgId)
        .in("id", part);
      if (error) throw new Error(error.message);
    }
    await supabase.from("rollover_runs").update({ status: "applied" }).eq("org_id", g.orgId).eq("id", run.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("rollover_runs").update({ status: "failed", error: message }).eq("org_id", g.orgId).eq("id", run.id);
    revalidateAll();
    return { ok: false, error: `The rollover stopped partway (${message}). You can undo it from the history below.` };
  }

  revalidateAll();
  return {
    ok: true,
    message: `Promoted ${plan.promotions.length} students${plan.graduates.length ? `, graduated ${plan.graduates.length}` : ""}${plan.parents.length ? `, archived ${plan.parents.length} parents` : ""}.`,
  };
}

function revalidateAll() {
  for (const p of ["/settings/rollover", "/people", "/audiences", "/dashboard", "/settings"]) revalidatePath(p);
}

/**
 * Undo a rollover. Only people who still have exactly what the rollover set
 * are reverted — anyone edited since (or re-synced) is left alone.
 */
export async function undoRollover(runId: string): Promise<{ ok: true; message: string } | Fail> {
  const g = await gate();
  if ("ok" in g) return g;
  const supabase = await createSupabaseServerClient();
  const { data: run } = await supabase
    .from("rollover_runs")
    .select("id, status, changes, created_at")
    .eq("org_id", g.orgId)
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { ok: false, error: "Rollover not found." };
  if (run.status === "undone") return { ok: false, error: "That rollover was already undone." };

  const changes = (run.changes ?? []) as RolloverChange[];
  let reverted = 0;
  const groups = new Map<string, { from: string; to: string; ids: string[] }>();
  const reactivate: string[] = [];
  for (const c of changes) {
    if (c.kind === "promote") {
      const key = `${c.from}→${c.to}`;
      const gr = groups.get(key) ?? { from: c.from, to: c.to, ids: [] };
      gr.ids.push(c.id);
      groups.set(key, gr);
    } else reactivate.push(c.id);
  }
  for (const gr of groups.values()) {
    for (const part of chunk(gr.ids, 150)) {
      const { data } = await supabase
        .from("people")
        .update({ grade: gr.from, updated_at: new Date().toISOString() })
        .eq("org_id", g.orgId)
        .eq("grade", gr.to)
        .in("id", part)
        .select("id");
      reverted += data?.length ?? 0;
    }
  }
  for (const part of chunk(reactivate, 150)) {
    const { data } = await supabase
      .from("people")
      .update({ status: "active", archived_at: null, updated_at: new Date().toISOString() })
      .eq("org_id", g.orgId)
      .eq("status", "archived")
      .gte("archived_at", run.created_at as string)
      .in("id", part)
      .select("id");
    reverted += data?.length ?? 0;
  }

  await supabase.from("rollover_runs").update({ status: "undone", undone_at: new Date().toISOString() }).eq("org_id", g.orgId).eq("id", runId);
  revalidateAll();
  return { ok: true, message: `Restored ${reverted} of ${changes.length} changes.` };
}
