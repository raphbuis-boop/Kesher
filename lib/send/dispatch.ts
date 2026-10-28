/**
 * The dispatcher: everything that happens on a timer rather than on a click.
 * Runs from /api/cron/dispatch (service role, no session), every few minutes.
 *
 *   1. Recurring sends   each due occurrence becomes one ordinary scheduled
 *                        message (exactly once — unique recurring_id +
 *                        scheduled_for). Occurrences missed by a long outage are
 *                        skipped, not sent late.
 *   2. Scheduled sends   due messages are claimed (scheduled → sending,
 *                        atomically) and run through the same send engine as a
 *                        manual send. Held back while an org is inside its
 *                        Shabbos / Yom Tov window; they go out when it ends.
 *   3. Unfinished sends  anything still 'sending' with a stale claim (a
 *                        crashed function, a very large audience, a webhook
 *                        fallback) is resumed. Rows are claimed individually,
 *                        so a message can never be delivered twice.
 *
 * Every query is filtered by org_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { nextClockOccurrence, validClockRule, DEFAULT_TIMEZONE, type ClockRule } from "@/lib/schoolTime";
import { nextZmanimOccurrence, validZmanimRule, type ZmanimRule } from "@/lib/zmanim";
import { getUpcomingWindows } from "@/lib/shabbos";
import { executeMessage, type EngineCtx } from "./engine";
import { messageColumns } from "./record";
import { sendWindowStatus } from "./window";
import { refreshStaleSchools } from "@/lib/shabbos";
import { retryPendingConfirmations } from "@/lib/inbound";
import type { MessageInput } from "./types";

export const RESUME_AFTER_MS = 3 * 60_000;
/** A recurring occurrence this far overdue is skipped rather than sent at a surprising time. */
export const MISSED_GRACE_MS = 12 * 3_600_000;
export const HEARTBEAT = "dispatch";

export type RecurringRule = ClockRule | ZmanimRule;

export type RecurringRow = {
  id: string;
  org_id: string;
  name: string;
  timezone: string;
  rule: unknown;
  payload: MessageInput;
  next_run_at: string | null;
  created_by: string | null;
};

export type DispatchSummary = {
  recurringCreated: number;
  recurringSkipped: number;
  sent: number;
  heldForShabbos: number;
  resumed: number;
  errors: string[];
};

/**
 * Next time a recurring rule fires after `after`. Clock rules are pure; zmanim
 * rules (candle lighting / Havdalah) read the school's cached Hebcal windows,
 * so they need `ctx`. Null if the rule is unusable or, for zmanim, the cached
 * times don't reach that far yet.
 */
export async function nextRunFor(rule: unknown, timezone: string, after: Date, ctx?: { supabase: SupabaseClient; orgId: string }): Promise<Date | null> {
  const tz = timezone || DEFAULT_TIMEZONE;
  if (validClockRule(rule)) return nextClockOccurrence(rule, tz, after);
  if (validZmanimRule(rule) && ctx) {
    const windows = await getUpcomingWindows(ctx.supabase, ctx.orgId, new Date(after.getTime() - 3 * 86_400_000), 60);
    return nextZmanimOccurrence(rule, windows, tz, after);
  }
  return null;
}

async function createOccurrences(supabase: SupabaseClient, now: Date, summary: DispatchSummary): Promise<void> {
  const { data } = await supabase
    .from("recurring_sends")
    .select("id, org_id, name, timezone, rule, payload, next_run_at, created_by")
    .eq("active", true)
    .lte("next_run_at", now.toISOString())
    .order("next_run_at")
    .limit(200);

  for (const rec of (data ?? []) as RecurringRow[]) {
    try {
      if (!rec.next_run_at) continue;
      // Walk forward through every occurrence that has come due: recent ones become messages, long-missed ones are skipped
      let at: Date | null = new Date(rec.next_run_at);
      for (let guard = 0; at && at.getTime() <= now.getTime() && guard < 60; guard++) {
        if (now.getTime() - at.getTime() <= MISSED_GRACE_MS) {
          const { error } = await supabase.from("messages").insert({
            org_id: rec.org_id,
            ...messageColumns(rec.payload),
            recipient_count: 0,
            status: "scheduled",
            scheduled_for: at.toISOString(),
            recurring_id: rec.id,
            created_by: rec.created_by,
          });
          // 23505: this occurrence already exists (the dispatcher ran twice) — fine
          if (error && error.code !== "23505") throw new Error(error.message);
          if (!error) summary.recurringCreated++;
        } else {
          summary.recurringSkipped++;
        }
        at = await nextRunFor(rec.rule, rec.timezone, at, { supabase, orgId: rec.org_id });
      }
      // A zmanim rule whose times haven't been loaded yet waits (and is retried below); a broken clock rule is switched off
      const waiting = !at && validZmanimRule(rec.rule);
      await supabase
        .from("recurring_sends")
        .update({ next_run_at: at ? at.toISOString() : null, last_run_at: now.toISOString(), ...(at || waiting ? {} : { active: false }) })
        .eq("org_id", rec.org_id)
        .eq("id", rec.id)
        .eq("next_run_at", rec.next_run_at);
    } catch (err) {
      summary.errors.push(`recurring ${rec.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Zmanim rules that were waiting for Hebcal times pick up again as soon as they exist
  const { data: waitingRows } = await supabase
    .from("recurring_sends")
    .select("id, org_id, timezone, rule")
    .eq("active", true)
    .is("next_run_at", null)
    .limit(50);
  for (const rec of (waitingRows ?? []) as Pick<RecurringRow, "id" | "org_id" | "timezone" | "rule">[]) {
    if (!validZmanimRule(rec.rule)) continue;
    try {
      const next = await nextRunFor(rec.rule, rec.timezone, now, { supabase, orgId: rec.org_id });
      if (next) await supabase.from("recurring_sends").update({ next_run_at: next.toISOString() }).eq("org_id", rec.org_id).eq("id", rec.id).is("next_run_at", null);
    } catch (err) {
      summary.errors.push(`recurring ${rec.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

type DueRow = { id: string; org_id: string; claimed_at?: string | null; window_override_reason?: string | null };

export async function dispatchDue(
  supabase: SupabaseClient,
  opts: { now?: Date; deadlineMs?: number; /** test overrides for the send engine */ engine?: Pick<EngineCtx, "senders" | "cfg"> } = {}
): Promise<DispatchSummary> {
  const now = opts.now ?? new Date();
  const deadline = opts.deadlineMs ?? Date.now() + 45_000;
  const summary: DispatchSummary = { recurringCreated: 0, recurringSkipped: 0, sent: 0, heldForShabbos: 0, resumed: 0, errors: [] };

  await supabase.from("system_heartbeats").upsert({ name: HEARTBEAT, last_run_at: now.toISOString(), detail: null }, { onConflict: "name" });

  // Keep each school's Shabbos / Yom Tov times fresh (weekly), before anything asks about them
  try {
    await refreshStaleSchools(supabase, now);
  } catch (err) {
    summary.errors.push(`shabbos refresh: ${err instanceof Error ? err.message : String(err)}`);
  }

  // The one confirmation text after a STOP: try again if the first send failed (for five minutes, three tries)
  try {
    await retryPendingConfirmations(supabase, now);
  } catch (err) {
    summary.errors.push(`opt-out confirmations: ${err instanceof Error ? err.message : String(err)}`);
  }

  await createOccurrences(supabase, now, summary);

  // One Shabbos check per school per run
  const windows = new Map<string, Awaited<ReturnType<typeof sendWindowStatus>>>();
  const windowFor = async (orgId: string) => {
    let w = windows.get(orgId);
    if (!w) {
      w = await sendWindowStatus(supabase, orgId, now);
      windows.set(orgId, w);
    }
    return w;
  };

  const run = async (row: DueRow, resumed: boolean) => {
    try {
      const result = await executeMessage({ supabase, orgId: row.org_id, ...opts.engine }, row.id, { deadlineMs: Math.min(deadline, Date.now() + 40_000) });
      if (result.state === "partial") {
        // Not finished: free the claim so the next run continues it
        await supabase.from("messages").update({ claimed_at: null }).eq("org_id", row.org_id).eq("id", row.id).eq("status", "sending");
      }
      if (resumed) summary.resumed++;
      else summary.sent++;
    } catch (err) {
      summary.errors.push(`message ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Scheduled sends that are due ──
  const { data: due } = await supabase
    .from("messages")
    .select("id, org_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for")
    .limit(100);
  for (const row of (due ?? []) as DueRow[]) {
    if (Date.now() >= deadline) break;
    if ((await windowFor(row.org_id)).blocked) {
      summary.heldForShabbos++;
      continue;
    }
    const { data: claimed } = await supabase
      .from("messages")
      .update({ status: "sending", claimed_at: now.toISOString() })
      .eq("org_id", row.org_id)
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id");
    if (!claimed || claimed.length === 0) continue; // another run got it
    await run(row, false);
  }

  // ── Unfinished sends ──
  const cutoff = new Date(now.getTime() - RESUME_AFTER_MS).toISOString();
  const stale: DueRow[] = [];
  for (const q of [
    supabase.from("messages").select("id, org_id, claimed_at, window_override_reason").eq("status", "sending").is("claimed_at", null).lt("created_at", cutoff).limit(30),
    supabase.from("messages").select("id, org_id, claimed_at, window_override_reason").eq("status", "sending").lt("claimed_at", cutoff).limit(30),
  ]) {
    const { data: rows } = await q;
    stale.push(...((rows ?? []) as DueRow[]));
  }
  for (const row of stale) {
    if (Date.now() >= deadline) break;
    // An owner's emergency override (logged when it was sent) lets it finish
    if (!row.window_override_reason && (await windowFor(row.org_id)).blocked) {
      summary.heldForShabbos++;
      continue;
    }
    // Compare-and-swap on the old claim so two dispatchers don't both resume it
    const claim = supabase.from("messages").update({ claimed_at: now.toISOString() }).eq("org_id", row.org_id).eq("id", row.id).eq("status", "sending");
    const { data: got } = await (row.claimed_at ? claim.eq("claimed_at", row.claimed_at) : claim.is("claimed_at", null)).select("id");
    if (!got || got.length === 0) continue;
    await run(row, true);
  }

  await supabase
    .from("system_heartbeats")
    .upsert({ name: HEARTBEAT, last_run_at: new Date().toISOString(), detail: summary }, { onConflict: "name" });
  return summary;
}
