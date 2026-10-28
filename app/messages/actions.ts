"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership } from "@/lib/org";
import { getChannelConfig } from "@/lib/channels";
import { loadBrandingSettings } from "@/lib/settings";
import { getTemplate } from "@/lib/templates";
import { renderTemplate } from "@/lib/template";
import { childrenLabel } from "@/lib/family";
import { FUNDRAISING_WHATSAPP_NOTE } from "@/lib/fundraising";
import { validateUnsubscribeEnv } from "@/lib/unsubscribe";
import { availableChannels, executeMessage, whatsappAllowedFor } from "@/lib/send/engine";
import { resolveRecipients } from "@/lib/send/recipients";
import { sendWindowStatus } from "@/lib/send/window";
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
  const { orgId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  const isSim = await simulated(orgId);
  const { channels, notes } = effectiveChannels(input);
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
    notes,
    samples,
    people_list: [...byPerson.values()],
  };
}

// ─── Send ─────────────────────────────────────────────────────────────────────

export type SubmitResult =
  | { success: true; messageId: string; state: "sent" | "sending"; sent: number; failed: number; remaining: number }
  | { success: false; error: string };

function validate(input: MessageInput): string | null {
  if (input.audienceSlugs.length === 0) return "At least one audience is required.";
  if (input.channels.length === 0) return "Choose at least one channel.";
  if (input.channels.includes("email") && !input.subject) return "Subject is required for email.";
  if (!input.body) return "Message body is required.";
  return null;
}

/**
 * Sends a message now: saves it, then runs the send engine right here. Large
 * sends that don't finish in time keep going (Continue sending / the
 * scheduler picks up whatever is still queued; nobody gets it twice).
 */
export async function submitMessage(raw: MessageInput): Promise<SubmitResult> {
  try {
    const input = clean(raw);
    const bad = validate(input);
    if (bad) return { success: false, error: bad };

    const { orgId } = await getMembership();
    const supabase = await createSupabaseServerClient();
    const isSim = await simulated(orgId);

    const window = await sendWindowStatus();
    if (window.blocked) return { success: false, error: window.message };

    // Fundraising never goes on WhatsApp (Meta blocks it to US numbers)
    const { channels, notes } = effectiveChannels(input);
    if (channels.length === 0) return { success: false, error: notes[0] ?? "Choose a channel." };
    const finalInput: MessageInput = { ...input, channels };

    const problems = await channelProblems(orgId, finalInput, isSim);
    if (problems.length > 0) return { success: false, error: problems.map((p) => p.problem).join(" ") };

    const { data: row, error } = await supabase
      .from("messages")
      .insert({
        org_id: orgId,
        subject: channels.includes("email") ? finalInput.subject : null,
        body: finalInput.body,
        channel: channels.length === 1 ? channels[0] : "multi",
        channels,
        channel_mode: finalInput.channelMode,
        audience_slug: finalInput.audienceSlugs.join(","),
        audience_label: finalInput.audienceLabel || "Audience",
        recipient_count: 0,
        status: "sending",
        template_id: finalInput.templateId,
        is_fundraising: finalInput.isFundraising,
        is_emergency: finalInput.isEmergency,
        family_prefix: finalInput.familyPrefix,
        payload: finalInput,
      })
      .select("id")
      .single();
    if (error || !row) return { success: false, error: error?.message ?? "Failed to create message record." };

    const result = await executeMessage({ supabase, orgId }, row.id as string, { deadlineMs: Date.now() + 50_000 });
    revalidatePath("/messages");
    revalidatePath("/dashboard");

    if (result.state === "failed") return { success: false, error: result.error };
    if (result.state === "skipped") return { success: false, error: result.reason };
    if (result.state === "partial") return { success: true, messageId: row.id as string, state: "sending", sent: result.sent, failed: result.failed, remaining: result.remaining };
    return { success: true, messageId: row.id as string, state: "sent", sent: result.sent, failed: result.failed, remaining: 0 };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    console.error("[submitMessage] UNCAUGHT EXCEPTION:", e.message, e.stack);
    return { success: false, error: `Server error: ${e.message}` };
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
