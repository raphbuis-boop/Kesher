import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getChannelConfig } from "@/lib/channels";
import { getWhatsAppProvider } from "@/lib/sms-provider";
import { realSenders } from "@/lib/send/senders";
import { sendWindowStatus } from "@/lib/send/window";
import { loadBrandingSettings } from "@/lib/settings";
import { toE164 } from "@/lib/phone";
import { isActiveSuppression } from "@/lib/suppressions";

/**
 * The two-way inbox: parents' replies by text and WhatsApp, one conversation
 * per guardian per school, staff replies from inside Kesher.
 *
 * WhatsApp only allows free-form replies within 24 hours of the parent's last
 * WhatsApp message; after that a staff reply has to go out as an approved
 * template (which Kesher offers instead of silently failing).
 */

export type InboxChannel = "sms" | "whatsapp";
export const WHATSAPP_WINDOW_MS = 24 * 3_600_000;

export type ThreadKind = "message" | "optout" | "optin";

const preview = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim().slice(0, 140);

/** Stores an inbound message in the parent's conversation (creating it if needed). Called by lib/inbound.ts. */
export async function recordInboundThread(
  admin: SupabaseClient,
  p: {
    orgId: string;
    personId: string | null;
    address: string;
    channel: InboxChannel;
    body: string | null;
    providerMessageId: string;
    receivedAt: string;
    kind: ThreadKind;
    replyToRecipientId: string | null;
    profileName?: string | null;
  }
): Promise<{ threadId: string; duplicate: boolean }> {
  const externalId = `${p.orgId}:${p.personId ?? `addr:${p.address}`}`;
  let displayName = p.profileName ?? null;
  if (p.personId) {
    const { data: person } = await admin.from("people").select("first_name, last_name").eq("org_id", p.orgId).eq("id", p.personId).maybeSingle();
    if (person) displayName = `${person.first_name} ${person.last_name}`.trim() || displayName;
  }

  let { data: thread } = await admin.from("message_threads").select("id, unread_count").eq("external_id", externalId).maybeSingle();
  if (!thread) {
    const { data, error } = await admin
      .from("message_threads")
      .insert({ org_id: p.orgId, person_id: p.personId, channel: p.channel, external_id: externalId, address: p.address, display_name: displayName, status: "open" })
      .select("id, unread_count")
      .single();
    if (error) {
      // 23505: two messages from the same parent arrived together
      if (error.code !== "23505") throw new Error(`Couldn't open the conversation: ${error.message}`);
      ({ data: thread } = await admin.from("message_threads").select("id, unread_count").eq("external_id", externalId).maybeSingle());
    } else thread = data;
  }
  if (!thread) throw new Error("Couldn't open the conversation.");

  const { error: insertError } = await admin.from("thread_messages").insert({
    thread_id: thread.id,
    org_id: p.orgId,
    direction: "inbound",
    channel: p.channel,
    body: p.body,
    provider_message_id: p.providerMessageId,
    status: "received",
    kind: p.kind,
    reply_to_recipient_id: p.replyToRecipientId,
    sent_at: p.receivedAt,
  });
  if (insertError) {
    if (insertError.code === "23505") return { threadId: thread.id as string, duplicate: true };
    throw new Error(`Couldn't save the message: ${insertError.message}`);
  }

  const isMessage = p.kind === "message";
  await admin
    .from("message_threads")
    .update({
      channel: p.channel,
      address: p.address,
      ...(displayName ? { display_name: displayName } : {}),
      last_message_at: p.receivedAt,
      last_preview: p.kind === "optout" ? "Opted out (replied STOP)" : p.kind === "optin" ? "Resubscribed (replied START)" : preview(p.body),
      last_inbound_at: p.receivedAt,
      last_inbound_channel: p.channel,
      ...(p.channel === "whatsapp" ? { last_whatsapp_inbound_at: p.receivedAt } : {}),
      // A real message reopens a finished conversation and counts as unread; keywords just appear in the history
      ...(isMessage ? { unread_count: (thread.unread_count as number) + 1, status: "open" } : {}),
    })
    .eq("id", thread.id);
  return { threadId: thread.id as string, duplicate: false };
}

// ─── Staff replies ───────────────────────────────────────────────────────────

export type Transport = (orgId: string, kind: "sms" | "whatsapp_text" | "whatsapp_template", to: string, body: string) => Promise<{ providerId: string | null; error?: string }>;

export const defaultTransport: Transport = async (orgId, kind, to, body) => {
  const admin = createSupabaseAdminClient();
  const { data: sim } = await admin.from("settings").select("value").eq("org_id", orgId).eq("key", "simulate_sends").maybeSingle();
  if (sim?.value === "true") return { providerId: `demo-${crypto.randomUUID()}` };
  const cfg = await getChannelConfig(orgId);
  if (kind === "sms") {
    if (!cfg.sms) return { providerId: null, error: cfg.smsProblem ?? "Texting isn't set up for this school." };
    return realSenders(cfg).sms({ to, from: cfg.sms.sender, body });
  }
  if (!cfg.whatsapp) return { providerId: null, error: cfg.whatsappProblem ?? "WhatsApp isn't set up for this school." };
  const provider = getWhatsAppProvider(cfg.whatsapp);
  if (kind === "whatsapp_text") {
    const r = await provider.sendText(to, body);
    return { providerId: r.providerId, error: r.success ? undefined : r.error };
  }
  const branding = await loadBrandingSettings(admin, orgId);
  const r = await provider.send("whatsapp", { to, from: "", body, label: branding.schoolName || "Your school" });
  return { providerId: r.providerId, error: r.success ? undefined : r.error };
};

export type ReplyResult =
  | { ok: true; messageId: string; usedTemplate: boolean }
  | { ok: false; error: string; code: "window_closed" | "opted_out" | "paused" | "no_address" | "failed" | "invalid" };

export async function sendThreadMessage(
  supabase: SupabaseClient,
  ctx: { orgId: string; userId: string },
  input: { threadId: string; body: string; channel: InboxChannel; asTemplate?: boolean },
  deps: { transport?: Transport; now?: Date } = {}
): Promise<ReplyResult> {
  const now = deps.now ?? new Date();
  const body = input.body.trim();
  if (!body) return { ok: false, code: "invalid", error: "Write a reply first." };
  if (body.length > 1000) return { ok: false, code: "invalid", error: "That's too long for a text. Keep it under 1,000 characters." };

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, person_id, address, last_inbound_channel, last_whatsapp_inbound_at")
    .eq("org_id", ctx.orgId)
    .eq("id", input.threadId)
    .maybeSingle();
  if (!thread) return { ok: false, code: "invalid", error: "That conversation no longer exists." };

  let personNumbers: (string | null)[] = [];
  if (thread.person_id) {
    const { data: person } = await supabase.from("people").select("phone, whatsapp").eq("org_id", ctx.orgId).eq("id", thread.person_id as string).maybeSingle();
    personNumbers = input.channel === "whatsapp" ? [person?.whatsapp as string | null, person?.phone as string | null] : [person?.phone as string | null];
  }
  const written = thread.address as string | null;
  // The number they actually wrote from wins when it's the same kind of channel; otherwise what's on their record
  const candidates = thread.last_inbound_channel === input.channel ? [written, ...personNumbers] : [...personNumbers, written];
  const address = candidates.map((c) => (c ? toE164(c) : null)).find((x): x is string => !!x);
  if (!address) return { ok: false, code: "no_address", error: `There's no ${input.channel === "sms" ? "mobile" : "WhatsApp"} number on file for them.` };

  if (await isActiveSuppression(supabase, ctx.orgId, input.channel, address)) {
    return { ok: false, code: "opted_out", error: `They opted out of ${input.channel === "sms" ? "texts" : "WhatsApp messages"}, so Kesher can't message them there. If they ask to be added back, an admin can restore them on their profile.` };
  }
  const window = await sendWindowStatus(supabase, ctx.orgId, now);
  if (window.blocked) return { ok: false, code: "paused", error: window.message };

  let kind: "sms" | "whatsapp_text" | "whatsapp_template" = "sms";
  if (input.channel === "whatsapp") {
    const lastIn = thread.last_whatsapp_inbound_at ? new Date(thread.last_whatsapp_inbound_at as string).getTime() : 0;
    const open = now.getTime() - lastIn <= WHATSAPP_WINDOW_MS;
    if (open) kind = "whatsapp_text";
    else if (input.asTemplate) kind = "whatsapp_template";
    else return { ok: false, code: "window_closed", error: "It's been more than 24 hours since they last wrote on WhatsApp, so WhatsApp only lets you start again with an approved template message." };
  }

  const transport = deps.transport ?? defaultTransport;
  const sent = await transport(ctx.orgId, kind, address, body);
  const { data: row, error } = await supabase
    .from("thread_messages")
    .insert({
      thread_id: thread.id,
      org_id: ctx.orgId,
      direction: "outbound",
      channel: input.channel,
      body,
      provider_message_id: sent.providerId,
      status: sent.providerId ? "sent" : "failed",
      error_detail: sent.providerId ? null : (sent.error ?? "Send failed"),
      sent_by: ctx.userId,
      sent_at: now.toISOString(),
      kind: "message",
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, code: "failed", error: error?.message ?? "Couldn't save the reply." };
  if (!sent.providerId) return { ok: false, code: "failed", error: sent.error ?? "The message couldn't be sent." };

  await supabase.from("message_threads").update({ last_message_at: now.toISOString(), last_preview: `You: ${preview(body)}`, unread_count: 0 }).eq("org_id", ctx.orgId).eq("id", thread.id);
  return { ok: true, messageId: row.id as string, usedTemplate: kind === "whatsapp_template" };
}

/** Delivery receipts for staff replies (called from the Sinch and Meta webhooks). */
export async function updateThreadMessageStatus(admin: SupabaseClient, providerMessageId: string, status: "delivered" | "read" | "failed", error?: string): Promise<void> {
  await admin
    .from("thread_messages")
    .update({ status, ...(error ? { error_detail: error } : {}) })
    .eq("provider_message_id", providerMessageId)
    .eq("direction", "outbound");
}

/** Is WhatsApp's free-form reply window still open, and until when? */
export function whatsappWindow(lastInboundAt: string | null | undefined, now: Date = new Date()): { open: boolean; until: string | null } {
  if (!lastInboundAt) return { open: false, until: null };
  const until = new Date(new Date(lastInboundAt).getTime() + WHATSAPP_WINDOW_MS);
  return { open: until.getTime() > now.getTime(), until: until.toISOString() };
}
