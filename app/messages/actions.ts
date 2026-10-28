"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { getChannelConfig } from "@/lib/channels";
import { loadBrandingSettings } from "@/lib/settings";
import { getTemplate } from "@/lib/templates";
import { renderTemplate } from "@/lib/template";
import { childrenLabel } from "@/lib/family";
import { FUNDRAISING_WHATSAPP_NOTE } from "@/lib/fundraising";
import { validateUnsubscribeEnv } from "@/lib/unsubscribe";
import { availableChannels, executeMessage, whatsappAllowedFor } from "@/lib/send/engine";
import { resolveRecipients } from "@/lib/send/recipients";
import { sendWindowStatus, type SendWindowStatus } from "@/lib/send/window";
import { describeZmanimRule, MAX_OFFSET_MINUTES, zmanimTime, type ZmanimAnchor, type ZmanimRule } from "@/lib/zmanim";
import { getUpcomingWindows } from "@/lib/shabbos";
import { localDateString } from "@/lib/schoolTime";
import { messageColumns } from "@/lib/send/record";
import { nextRunFor } from "@/lib/send/dispatch";
import {
  describeClockRule,
  formatInZone,
  getRequireApproval,
  getSchoolTimezone,
  isDateString,
  isTimeString,
  weekdayOf,
  zonedToUtc,
  type ClockRule,
} from "@/lib/schoolTime";
import { CHANNELS, type Channel, type ExcludedReason, type MessageInput } from "@/lib/send/types";

export type { Channel, MessageInput } from "@/lib/send/types";

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function simulated(orgId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("settings").select("value").eq("org_id", orgId).eq("key", "simulate_sends").maybeSingle();
  return data?.value === "true";
}

/** Plain-words problems for each selected channel that can't send right now. */
async function channelProblems(orgId: string, input: MessageInput, isSimulated: boolean): Promise<{ channel: Channel; problem: string }[]> {
  if (isSimulated) return [];
  const cfg = await getChannelConfig(orgId);
  const out: { channel: Channel; problem: string }[] = [];
  for (const c of input.channels) {
    if (c === "email") {
      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) out.push({ channel: c, problem: "Email delivery is not configured for this account. Contact your administrator." });
      else {
        const p = validateUnsubscribeEnv();
        if (p) out.push({ channel: c, problem: p });
      }
    } else if (c === "sms" && cfg.smsProblem) out.push({ channel: c, problem: `${cfg.smsProblem} Set it up in Settings → Channels.` });
    else if (c === "whatsapp" && cfg.whatsappProblem) out.push({ channel: c, problem: `${cfg.whatsappProblem} Set it up in Settings → Channels.` });
  }
  return out;
}

/** Normalizes what the browser sent. */
function clean(raw: MessageInput): MessageInput {
  const channels = [...new Set((raw.channels ?? []).filter((c): c is Channel => CHANNELS.includes(c)))];
  return {
    audienceSlugs: [...new Set((raw.audienceSlugs ?? []).filter((s) => typeof s === "string" && s))],
    audienceLabel: String(raw.audienceLabel ?? "").slice(0, 200),
    channels,
    channelMode: raw.channelMode === "best" ? "best" : "all",
    subject: String(raw.subject ?? "").trim(),
    body: String(raw.body ?? "").trim(),
    greeting: raw.greeting ? String(raw.greeting).slice(0, 200) : null,
    attachmentUrls: (raw.attachmentUrls ?? []).filter((u) => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 10),
    templateId: raw.templateId || null,
    isFundraising: !!raw.isFundraising,
    isEmergency: !!raw.isEmergency,
    familyPrefix: !!raw.familyPrefix,
    confirmButton: !!raw.confirmButton,
    studentsDirect: !!raw.studentsDirect,
    excludePersonIds: (raw.excludePersonIds ?? []).filter((s) => typeof s === "string"),
    onlyPersonIds: raw.onlyPersonIds ? raw.onlyPersonIds.filter((s) => typeof s === "string") : null,
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

export type PreviewResult = {
  /** Distinct parents/adults who will receive at least one message */
  people: number;
  perChannel: Record<Channel, number>;
  /** Total messages (a parent on two channels counts twice) */
  messages: number;
  excluded: Record<ExcludedReason, number>;
  unreachable: { name: string; reason: string }[];
  unreachableCount: number;
  studentsWithoutParent: number;
  /** Channels that can't send, with why */
  problems: { channel: Channel; problem: string }[];
  /** Channels dropped for this message (e.g. WhatsApp for fundraising) */
  notes: string[];
  samples: { name: string; channel: Channel; address: string; subject: string | null; text: string; childrenLabel: string | null }[];
  /** Is sending paused right now (Shabbos / Yom Tov)? Owners may override in an emergency. */
  window: SendWindowStatus;
  canOverrideWindow: boolean;
  /** Who gets it — for the confirm step */
  people_list: { id: string; name: string; channels: { channel: Channel; address: string }[]; childrenLabel: string | null }[];
};

/** Adjusts the channel list for rules that apply to this message (fundraising never goes on WhatsApp). */
function effectiveChannels(input: MessageInput): { channels: Channel[]; notes: string[] } {
  const notes: string[] = [];
  let channels = input.channels;
  if (channels.includes("whatsapp") && !whatsappAllowedFor(input)) {
    channels = channels.filter((c) => c !== "whatsapp");
    notes.push(input.isFundraising ? FUNDRAISING_WHATSAPP_NOTE : "This reads like a fundraising message, which WhatsApp doesn't allow, so it won't go out on WhatsApp.");
  }
  return { channels, notes };
}

/** Exactly who a send would reach on each channel, and why anyone is left out. */
export async function previewSend(raw: MessageInput): Promise<PreviewResult> {
  const input = clean(raw);
  const { orgId, role } = await getMembership();
  const supabase = await createSupabaseServerClient();
  const isSim = await simulated(orgId);
  const { channels, notes } = effectiveChannels(input);
  const window = await sendWindowStatus(supabase, orgId);
  const [cfg, branding, template] = await Promise.all([getChannelConfig(orgId), loadBrandingSettings(supabase, orgId), getTemplate(supabase, orgId, input.templateId)]);

  const resolution = await resolveRecipients(supabase, orgId, {
    audienceSlugs: input.audienceSlugs,
    channels,
    channelMode: input.channelMode,
    isEmergency: input.isEmergency,
    studentsDirect: input.studentsDirect,
    excludePersonIds: input.excludePersonIds,
    onlyPersonIds: input.onlyPersonIds,
    familyPrefix: input.familyPrefix,
    available: availableChannels(cfg, isSim, true),
  });

  const samples = resolution.recipients.slice(0, 8).map((r) => {
    let text = renderTemplate(input.body, { ...r.person, children: r.children });
    const label = r.children.length ? childrenLabel(r.children) : null;
    if (input.familyPrefix && label) text = `For ${label}${r.channel === "email" ? "\n\n" : ": "}${text}`;
    return {
      name: `${r.person.first_name} ${r.person.last_name}`.trim(),
      channel: r.channel,
      address: r.address,
      subject: r.channel === "email" ? renderTemplate(input.subject, { ...r.person, children: r.children }) : null,
      text,
      childrenLabel: label,
    };
  });

  const byPerson = new Map<string, PreviewResult["people_list"][number]>();
  for (const r of resolution.recipients) {
    const entry = byPerson.get(r.person.id) ?? { id: r.person.id, name: `${r.person.first_name} ${r.person.last_name}`.trim(), channels: [], childrenLabel: r.children.length ? childrenLabel(r.children) : null };
    entry.channels.push({ channel: r.channel, address: r.address });
    byPerson.set(r.person.id, entry);
  }

  void branding;
  void template;
  return {
    people: resolution.people,
    perChannel: resolution.perChannel,
    messages: resolution.recipients.length,
    excluded: resolution.excluded,
    unreachable: resolution.unreachable.slice(0, 50).map((u) => ({ name: `${u.person.first_name} ${u.person.last_name}`.trim(), reason: u.reason })),
    unreachableCount: resolution.unreachable.length,
    studentsWithoutParent: resolution.studentsWithoutParent,
    problems: await channelProblems(orgId, { ...input, channels }, isSim),
    window,
    canOverrideWindow: role === "owner",
    notes,
    samples,
    people_list: [...byPerson.values()],
  };
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export type SubmitAction = "send_now" | "schedule" | "draft" | "request_approval";

export type SubmitOptions = {
  action: SubmitAction;
  /** School-local date and time (school timezone, not the browser's) for "schedule" / a requested time */
  when?: { date: string; time: string } | null;
  /** schedule only: repeat every N weeks on that weekday (admins) */
  repeatWeeks?: number | null;
  /** Editing an existing draft / scheduled / waiting message */
  messageId?: string | null;
  /** Editing a repeating send */
  recurringId?: string | null;
  /** This is a reminder for an earlier message */
  resendOf?: string | null;
  /**
   * Tie the send time to the Jewish calendar instead of the clock: "3 hours before candle lighting",
   * "30 minutes after Havdalah". windowStartsAt picks which Shabbos / Yom Tov (an ISO instant from the
   * school's cached times); repeatWeeks repeats it on regular Shabbosim. offsetMinutes < 0 is before.
   */
  zmanim?: { anchor: ZmanimAnchor; offsetMinutes: number; windowStartsAt: string; repeatWeeks?: number | null } | null;
  /** Owner only: send during Shabbos / Yom Tov for a real emergency. The reason is logged. */
  override?: { reason: string } | null;
};

export type SubmitResult =
  | { success: true; kind: "sent" | "sending"; messageId: string; sent: number; failed: number; remaining: number }
  | { success: true; kind: "scheduled"; messageId: string; whenLabel: string; note: string | null }
  | { success: true; kind: "draft"; messageId: string }
  | { success: true; kind: "pending_approval"; messageId: string; whenLabel: string | null }
  | { success: true; kind: "recurring"; recurringId: string; whenLabel: string; ruleLabel: string }
  | { success: false; error: string };

const fail = (error: string): SubmitResult => ({ success: false, error });

function validate(input: MessageInput): string | null {
  if (input.audienceSlugs.length === 0) return "At least one audience is required.";
  if (input.channels.length === 0) return "Choose at least one channel.";
  if (input.channels.includes("email") && !input.subject) return "Subject is required for email.";
  if (!input.body) return "Message body is required.";
  return null;
}

/** Statuses a message can still be edited in; members only touch their own unapproved ones. */
const EDITABLE = ["draft", "pending_approval", "scheduled", "rejected", "cancelled"];
const MEMBER_EDITABLE = ["draft", "pending_approval", "rejected"];

type Existing = { id: string; status: string; created_by: string | null };

async function loadExisting(orgId: string, id: string): Promise<Existing | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("messages").select("id, status, created_by").eq("org_id", orgId).eq("id", id).maybeSingle();
  return (data as Existing | null) ?? null;
}

/**
 * One entry point for the compose screen's buttons:
 *   send_now          save + send right here (admins, or members when approval isn't required)
 *   schedule          send later at a school-local date/time (optionally repeating weekly)
 *   draft             save without sending
 *   request_approval  members: ask an admin to send it
 * Members' send/schedule turn into an approval request when the school requires
 * approval. The audience is resolved when the message actually goes out, so
 * a scheduled message reaches the roster as it is then.
 */
export async function submitMessage(raw: MessageInput, opts: SubmitOptions = { action: "send_now" }): Promise<SubmitResult> {
  try {
    const { orgId, userId, role } = await getMembership();
    const admin = isAdminRole(role);
    const supabase = await createSupabaseServerClient();

    let input = clean(raw);
    if (!admin) input = { ...input, isEmergency: false }; // only owners/admins can flag emergencies
    const isSim = await simulated(orgId);
    const tz = await getSchoolTimezone(supabase, orgId);
    const needsApproval = !admin && (await getRequireApproval(supabase, orgId));

    let action = opts.action;
    if (needsApproval && (action === "send_now" || action === "schedule")) action = "request_approval";
    const repeating = !!opts.repeatWeeks || !!opts.recurringId || (!!opts.zmanim && !!opts.zmanim.repeatWeeks);
    if (repeating && !admin) return fail("Only owners and admins can set up repeating sends.");
    if (repeating && action !== "schedule") return fail("A repeating send needs a start date and time.");

    if (action === "draft") {
      if (!input.body && !input.subject && input.audienceSlugs.length === 0) return fail("There's nothing to save yet.");
    } else {
      const bad = validate(input);
      if (bad) return fail(bad);
    }

    // When
    let scheduledFor: Date | null = null;
    let zmanimRule: ZmanimRule | null = null;
    if (opts.zmanim && (action === "schedule" || action === "request_approval")) {
      // Relative to the Jewish calendar: work out the actual time from the school's Hebcal windows
      const z = opts.zmanim;
      if (z.anchor !== "candle_lighting" && z.anchor !== "havdalah") return fail("Choose candle lighting or Havdalah.");
      if (!Number.isInteger(z.offsetMinutes) || Math.abs(z.offsetMinutes) > MAX_OFFSET_MINUTES) return fail("That's too far from candle lighting / Havdalah. Use up to 72 hours.");
      const windows = await getUpcomingWindows(supabase, orgId, new Date(), 24);
      const w = windows.find((x) => new Date(x.startsAt).getTime() === new Date(z.windowStartsAt).getTime());
      if (!w) return fail("That Shabbos isn't in your calendar. Check Settings → Shabbos & Yom Tov.");
      scheduledFor = zmanimTime(w, z.anchor, z.offsetMinutes);
      if (z.repeatWeeks) {
        if (w.kind !== "shabbos") return fail("Repeating sends start on a regular Shabbos. Pick a Shabbos that isn't Yom Tov, or schedule this one on its own.");
        zmanimRule = { kind: "zmanim", anchor: z.anchor, offsetMinutes: z.offsetMinutes, everyWeeks: Math.min(12, Math.max(1, Math.round(z.repeatWeeks))), startDate: localDateString(new Date(w.startsAt), tz) };
      }
      if (!zmanimRule && scheduledFor.getTime() < Date.now() + 60_000) return fail("That time has already passed. Choose a later Shabbos.");
    } else if (action === "schedule" || (action === "request_approval" && opts.when)) {
      if (!opts.when || !isDateString(opts.when.date) || !isTimeString(opts.when.time)) return fail("Pick a date and time.");
      scheduledFor = zonedToUtc(opts.when.date, opts.when.time, tz);
      if (scheduledFor.getTime() < Date.now() + 60_000) return fail("Pick a time in the future.");
    }

    let finalInput = input;
    if (action !== "draft") {
      // Fundraising never goes on WhatsApp (Meta blocks it to US numbers)
      const { channels, notes } = effectiveChannels(input);
      if (channels.length === 0) return fail(notes[0] ?? "Choose a channel.");
      finalInput = { ...input, channels };
      const problems = await channelProblems(orgId, finalInput, isSim);
      if (problems.length > 0) return fail(problems.map((p) => p.problem).join(" "));
    }
    let overrideReason: string | null = null;
    let overrideLabel: string | null = null;
    if (action === "send_now") {
      const window = await sendWindowStatus(supabase, orgId);
      if (window.blocked) {
        if (!opts.override) return fail(window.message);
        if (role !== "owner") return fail("Only the school owner can send during Shabbos or Yom Tov.");
        const reason = opts.override.reason.trim();
        if (reason.length < 5) return fail("Type a reason for the emergency send, in a few words. It's recorded.");
        overrideReason = reason.slice(0, 500);
        overrideLabel = window.label;
      }
    }
    // A scheduled time inside Shabbos isn't an error — it just waits until Shabbos is over
    let scheduleNote: string | null = null;
    if (action === "schedule" && scheduledFor) {
      const w = await sendWindowStatus(supabase, orgId, scheduledFor);
      if (w.blocked && !w.approximate && w.until) scheduleNote = `That time is during ${w.label?.trim() || "Shabbos / Yom Tov"}, so it will go out after it ends, at ${formatInZone(w.until, tz)}.`;
    }

    // Editing something that already exists?
    let existing: Existing | null = null;
    if (opts.messageId) {
      existing = await loadExisting(orgId, opts.messageId);
      if (!existing) return fail("That message no longer exists.");
      const allowed = admin ? EDITABLE : MEMBER_EDITABLE;
      if (!allowed.includes(existing.status)) return fail(existing.status === "sending" || existing.status === "sent" ? "This message has already been sent." : "You can't edit this message.");
      if (!admin && existing.created_by !== userId) return fail("You can only edit your own drafts and requests.");
    }

    // Repeating send (admins): a blueprint the dispatcher turns into one message per occurrence
    if (repeating) {
      if (opts.recurringId && opts.zmanim && !zmanimRule) return fail("Choose how often this repeats.");
      const rule: ClockRule | ZmanimRule = zmanimRule ?? {
        kind: "clock",
        everyWeeks: opts.repeatWeeks ?? 1,
        weekday: weekdayOf(opts.when!.date),
        time: opts.when!.time,
        startDate: opts.when!.date,
      };
      // For a zmanim rule the first send is the chosen Shabbos itself, if it's still ahead
      const next = zmanimRule ? (await nextRunFor(rule, tz, new Date(Date.now() + 60_000), { supabase, orgId })) : await nextRunFor(rule, tz, new Date());
      if (!next) return fail("Couldn't work out when this repeats. Check the day, time and number of weeks.");
      const record = {
        name: (input.subject || input.body).slice(0, 80),
        timezone: tz,
        rule,
        payload: finalInput,
        subject: finalInput.channels.includes("email") ? finalInput.subject : null,
        body: finalInput.body,
        audience_label: finalInput.audienceLabel || "Audience",
        next_run_at: next.toISOString(),
        active: true,
      };
      let recurringId = opts.recurringId ?? null;
      if (recurringId) {
        const { data, error } = await supabase.from("recurring_sends").update(record).eq("org_id", orgId).eq("id", recurringId).select("id");
        if (error || !data?.length) return fail(error?.message ?? "That repeating send no longer exists.");
      } else {
        const { data, error } = await supabase.from("recurring_sends").insert({ org_id: orgId, created_by: userId, ...record }).select("id").single();
        if (error || !data) return fail(error?.message ?? "Couldn't save the repeating send.");
        recurringId = data.id as string;
      }
      // A draft/scheduled copy that was converted into a repeating send
      if (existing) await supabase.from("messages").delete().eq("org_id", orgId).eq("id", existing.id).in("status", EDITABLE);
      revalidatePath("/messages");
      return { success: true, kind: "recurring", recurringId, whenLabel: formatInZone(next, tz), ruleLabel: rule.kind === "zmanim" ? describeZmanimRule(rule) : describeClockRule(rule) };
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      ...messageColumns(finalInput),
      error_detail: null,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
    };
    if (opts.resendOf) patch.resend_of = opts.resendOf;
    if (action === "draft") Object.assign(patch, { status: "draft", scheduled_for: null, requested_at: null, approved_by: null, approved_at: null });
    else if (action === "request_approval") Object.assign(patch, { status: "pending_approval", scheduled_for: scheduledFor?.toISOString() ?? null, requested_at: now, approved_by: null, approved_at: null });
    else if (action === "schedule") Object.assign(patch, { status: "scheduled", scheduled_for: scheduledFor!.toISOString(), requested_at: existing?.status === "pending_approval" ? undefined : null, approved_by: userId, approved_at: now });
    else Object.assign(patch, { status: "sending", claimed_at: now, scheduled_for: null, approved_by: userId, approved_at: now, window_override_reason: overrideReason });
    for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];

    let messageId: string;
    if (existing) {
      // Guarded on status so a message the dispatcher just claimed can't be overwritten
      const { data, error } = await supabase.from("messages").update(patch).eq("org_id", orgId).eq("id", existing.id).in("status", admin ? EDITABLE : MEMBER_EDITABLE).select("id");
      if (error) return fail(error.message);
      if (!data?.length) return fail("This message changed while you were editing it. Reload and try again.");
      messageId = existing.id;
    } else {
      const { data, error } = await supabase.from("messages").insert({ org_id: orgId, created_by: userId, recipient_count: 0, ...patch }).select("id").single();
      if (error || !data) return fail(error?.message ?? "Failed to create message record.");
      messageId = data.id as string;
    }
    revalidatePath("/messages");
    revalidatePath("/dashboard");

    if (action === "draft") return { success: true, kind: "draft", messageId };
    if (action === "request_approval") return { success: true, kind: "pending_approval", messageId, whenLabel: scheduledFor ? formatInZone(scheduledFor, tz) : null };
    if (action === "schedule") return { success: true, kind: "scheduled", messageId, whenLabel: formatInZone(scheduledFor!, tz), note: scheduleNote };

    if (overrideReason) {
      // Logged before anything is sent
      await supabase.from("window_overrides").insert({ org_id: orgId, message_id: messageId, user_id: userId, reason: overrideReason, window_label: overrideLabel });
    }

    const result = await executeMessage({ supabase, orgId }, messageId, { deadlineMs: Date.now() + 50_000 });
    if (result.state === "failed") return fail(result.error);
    if (result.state === "skipped") return fail(result.reason);
    if (result.state === "partial") return { success: true, kind: "sending", messageId, sent: result.sent, failed: result.failed, remaining: result.remaining };
    return { success: true, kind: "sent", messageId, sent: result.sent, failed: result.failed, remaining: 0 };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[submitMessage] UNCAUGHT EXCEPTION:", e.message, e.stack);
    return fail(`Server error: ${e.message}`);
  }
}

/** Keep sending a message that didn't finish (large audiences, or a function that timed out). */
export async function continueSending(messageId: string): Promise<{ ok: true; remaining: number } | { ok: false; error: string }> {
  const { orgId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  const result = await executeMessage({ supabase, orgId }, messageId, { deadlineMs: Date.now() + 50_000 });
  revalidatePath(`/messages/${messageId}`);
  revalidatePath("/messages");
  if (result.state === "failed") return { ok: false, error: result.error };
  if (result.state === "skipped") return { ok: false, error: result.reason };
  return { ok: true, remaining: result.state === "partial" ? result.remaining : 0 };
}

// ─── Approvals, cancel, delete ────────────────────────────────────────────────

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function pendingOrScheduled(orgId: string, id: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("messages").select("id, status, created_by, scheduled_for, payload").eq("org_id", orgId).eq("id", id).maybeSingle();
  return { supabase, row: data as { id: string; status: string; created_by: string | null; scheduled_for: string | null; payload: MessageInput | null } | null };
}

/** Admin: approve a member's request. Goes out now, or at the time they asked for. */
export async function approveMessage(messageId: string): Promise<ActionResult> {
  try {
    const { orgId, userId, role } = await getMembership();
    if (!isAdminRole(role)) return { ok: false, error: "Only owners and admins can approve messages." };
    const { supabase, row } = await pendingOrScheduled(orgId, messageId);
    if (!row || row.status !== "pending_approval") return { ok: false, error: "This message isn't waiting for approval." };
    if (!row.payload) return { ok: false, error: "This message has no send settings saved." };

    const problems = await channelProblems(orgId, row.payload, await simulated(orgId));
    if (problems.length > 0) return { ok: false, error: problems.map((p) => p.problem).join(" ") };

    const now = new Date();
    const later = row.scheduled_for && new Date(row.scheduled_for).getTime() > now.getTime() + 60_000;
    if (!later) {
      const window = await sendWindowStatus(supabase, orgId);
      if (window.blocked) return { ok: false, error: window.message };
    }
    const { data, error } = await supabase
      .from("messages")
      .update(
        later
          ? { status: "scheduled", approved_by: userId, approved_at: now.toISOString() }
          : { status: "sending", claimed_at: now.toISOString(), scheduled_for: null, approved_by: userId, approved_at: now.toISOString() }
      )
      .eq("org_id", orgId)
      .eq("id", messageId)
      .eq("status", "pending_approval")
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "Someone else already handled this message." };
    revalidatePath("/messages");
    revalidatePath("/dashboard");
    if (later) return { ok: true, message: "Approved — it will send at the scheduled time." };
    const result = await executeMessage({ supabase, orgId }, messageId, { deadlineMs: Date.now() + 50_000 });
    if (result.state === "failed") return { ok: false, error: result.error };
    return { ok: true, message: "Approved and sent." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't approve." };
  }
}

export async function rejectMessage(messageId: string, reason: string): Promise<ActionResult> {
  try {
    const { orgId, userId, role } = await getMembership();
    if (!isAdminRole(role)) return { ok: false, error: "Only owners and admins can reject messages." };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("messages")
      .update({ status: "rejected", rejected_by: userId, rejected_at: new Date().toISOString(), rejection_reason: reason.trim().slice(0, 500) || null })
      .eq("org_id", orgId)
      .eq("id", messageId)
      .eq("status", "pending_approval")
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "This message isn't waiting for approval." };
    revalidatePath("/messages");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reject." };
  }
}

/** Stop a scheduled message or withdraw a request (admins any; members their own requests). */
export async function cancelMessage(messageId: string): Promise<ActionResult> {
  try {
    const { orgId, userId, role } = await getMembership();
    const { supabase, row } = await pendingOrScheduled(orgId, messageId);
    if (!row) return { ok: false, error: "That message no longer exists." };
    if (!isAdminRole(role) && (row.created_by !== userId || row.status !== "pending_approval")) return { ok: false, error: "Only owners and admins can cancel scheduled messages." };
    const { data, error } = await supabase
      .from("messages")
      .update({ status: "cancelled" })
      .eq("org_id", orgId)
      .eq("id", messageId)
      .in("status", ["scheduled", "pending_approval"])
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "It's too late to cancel — this message has already started sending." };
    revalidatePath("/messages");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't cancel." };
  }
}

/** Delete a draft, or a rejected/cancelled message that was never sent. */
export async function deleteUnsentMessage(messageId: string): Promise<ActionResult> {
  try {
    const { orgId, userId, role } = await getMembership();
    const { supabase, row } = await pendingOrScheduled(orgId, messageId);
    if (!row) return { ok: true };
    if (!["draft", "rejected", "cancelled"].includes(row.status)) return { ok: false, error: "Only drafts and unsent messages can be deleted." };
    if (!isAdminRole(role) && row.created_by !== userId) return { ok: false, error: "You can only delete your own drafts." };
    const { error } = await supabase.from("messages").delete().eq("org_id", orgId).eq("id", messageId).in("status", ["draft", "rejected", "cancelled"]);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/messages");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete." };
  }
}

export async function setRecurringActive(recurringId: string, active: boolean): Promise<ActionResult> {
  try {
    const { orgId, role } = await getMembership();
    if (!isAdminRole(role)) return { ok: false, error: "Only owners and admins can change repeating sends." };
    const supabase = await createSupabaseServerClient();
    const { data: rec } = await supabase.from("recurring_sends").select("id, timezone, rule").eq("org_id", orgId).eq("id", recurringId).maybeSingle();
    if (!rec) return { ok: false, error: "That repeating send no longer exists." };
    // Resuming picks up from the next future occurrence — it never sends what was missed while paused
    const next = active ? await nextRunFor(rec.rule, rec.timezone as string, new Date(), { supabase, orgId }) : null;
    if (active && !next) return { ok: false, error: "This repeating send's schedule is no longer valid. Edit it first." };
    const { error } = await supabase.from("recurring_sends").update({ active, next_run_at: next ? next.toISOString() : null }).eq("org_id", orgId).eq("id", recurringId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/messages");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update." };
  }
}

export async function deleteRecurring(recurringId: string): Promise<ActionResult> {
  try {
    const { orgId, role } = await getMembership();
    if (!isAdminRole(role)) return { ok: false, error: "Only owners and admins can change repeating sends." };
    const supabase = await createSupabaseServerClient();
    // Scheduled-but-unsent occurrences go with it
    await supabase.from("messages").update({ status: "cancelled" }).eq("org_id", orgId).eq("recurring_id", recurringId).eq("status", "scheduled");
    const { error } = await supabase.from("recurring_sends").delete().eq("org_id", orgId).eq("id", recurringId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/messages");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't delete." };
  }
}

/** For the schedule picker: is this school-local date/time inside Shabbos / Yom Tov? */
export async function checkSendWindow(date: string, time: string): Promise<{ held: boolean; note: string | null }> {
  if (!isDateString(date) || !isTimeString(time)) return { held: false, note: null };
  const { orgId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  const tz = await getSchoolTimezone(supabase, orgId);
  const w = await sendWindowStatus(supabase, orgId, zonedToUtc(date, time, tz));
  if (!w.blocked || w.approximate || !w.until) return { held: false, note: null };
  return { held: true, note: `That time is during ${w.label?.trim() || "Shabbos / Yom Tov"}. The message will wait and go out at ${formatInZone(w.until, tz)}.` };
}
