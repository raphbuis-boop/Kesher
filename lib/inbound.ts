import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getChannelConfig } from "@/lib/channels";
import { getWhatsAppProvider } from "@/lib/sms-provider";
import { realSenders } from "@/lib/send/senders";
import { loadBrandingSettings } from "@/lib/settings";
import { toE164 } from "@/lib/phone";
import { addSuppression, releaseSuppressions } from "@/lib/suppressions";
import { autoReplyText, parseKeyword, type ReplyKind } from "@/lib/optout";
import { chunk } from "@/lib/supabase-paging";
import { recordInboundThread } from "@/lib/inbox";

/**
 * Everything that arrives from a parent by text or WhatsApp, from any provider.
 *
 *   1. Work out which school(s) it is for and who the parent is.
 *   2. STOP and its synonyms: add the address to that school's suppression list,
 *      send the ONE confirmation, and stop. START resubscribes; HELP answers.
 *   3. Anything else is a reply: it is stored for the inbox.
 *
 * Sinch doesn't tell us which number was texted, so the school is found from who
 * last messaged this parent. If several schools did, a STOP applies to all of
 * them (a person who says STOP to a number must be left alone) while an ordinary
 * reply goes to the most recent one.
 */

export type InboundChannel = "sms" | "whatsapp";

export type InboundEvent = {
  channel: InboundChannel;
  /** Sender's number in any format */
  from: string;
  /** The school's number that was texted, when the provider says */
  to?: string | null;
  /** WhatsApp: the school's phone number ID from Meta */
  phoneNumberId?: string | null;
  body: string | null;
  providerMessageId: string;
  receivedAt: string;
  raw: unknown;
  profileName?: string | null;
};

export type ReplySender = (orgId: string, channel: InboundChannel, to: string, body: string) => Promise<{ ok: boolean; error?: string }>;

export type InboundDeps = { sendReply?: ReplySender; now?: Date };

export type InboundOutcome = {
  orgIds: string[];
  primaryOrgId: string | null;
  keyword: "stop" | "start" | "help" | null;
  /** Suppressions created by this message */
  suppressed: number;
  /** For the inbox: the stored inbound row (null for pure keywords or when no school matched) */
  inboundId: string | null;
  duplicate: boolean;
};

export function normalizeFrom(raw: string): string {
  return toE164(raw) ?? `+${raw.replace(/\D/g, "")}`;
}

type OutboundHit = { org_id: string; person_id: string; sent_at: string; id: string };

/** Schools that have messaged this address on this channel in the last six months, most recent first. */
async function recentOutbound(admin: SupabaseClient, channel: InboundChannel, address: string, now: Date): Promise<OutboundHit[]> {
  const since = new Date(now.getTime() - 180 * 86_400_000).toISOString();
  const { data } = await admin
    .from("message_recipients")
    .select("id, person_id, sent_at, channel, messages!inner(org_id, channel)")
    .eq("contact_value", address)
    .not("sent_at", "is", null)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as { id: string; person_id: string; sent_at: string; channel: string | null; messages: { org_id: string; channel: string } }[];
  return rows
    .filter((r) => {
      const c = r.channel ?? r.messages.channel;
      return c === channel || c === "multi";
    })
    .map((r) => ({ org_id: r.messages.org_id, person_id: r.person_id, sent_at: r.sent_at, id: r.id }));
}

export async function resolveInboundOrgs(admin: SupabaseClient, ev: InboundEvent, address: string, now: Date = new Date()): Promise<{ primary: string | null; all: string[]; hits: OutboundHit[] }> {
  const hits = await recentOutbound(admin, ev.channel, address, now);
  const recentOrder = [...new Set(hits.map((h) => h.org_id))];

  // WhatsApp: Meta tells us exactly which of our numbers was messaged
  if (ev.phoneNumberId) {
    const { data } = await admin.from("org_channels").select("org_id, use_env_defaults").eq("whatsapp_phone_number_id", ev.phoneNumberId);
    const direct = ((data ?? []) as { org_id: string }[]).map((r) => r.org_id);
    if (direct.length) return { primary: direct.find((o) => recentOrder.includes(o)) ?? direct[0], all: direct, hits };
    if (ev.phoneNumberId === process.env.META_WHATSAPP_PHONE_NUMBER_ID) {
      const { data: shared } = await admin.from("org_channels").select("org_id").eq("use_env_defaults", true);
      const envOrgs = new Set(((shared ?? []) as { org_id: string }[]).map((r) => r.org_id));
      const candidates = recentOrder.filter((o) => envOrgs.has(o));
      if (candidates.length) return { primary: candidates[0], all: candidates, hits };
    }
  }

  // SMS to a school's own number, when the provider says which
  if (ev.to) {
    const to = normalizeFrom(ev.to);
    const { data } = await admin.from("org_channels").select("org_id").eq("sms_sender", to);
    const direct = ((data ?? []) as { org_id: string }[]).map((r) => r.org_id);
    if (direct.length) return { primary: direct.find((o) => recentOrder.includes(o)) ?? direct[0], all: direct, hits };
  }

  return { primary: recentOrder[0] ?? null, all: recentOrder, hits };
}

async function languageFor(admin: SupabaseClient, orgId: string, personId: string | null): Promise<string | null> {
  if (!personId) return null;
  const { data } = await admin.from("contact_preferences").select("language").eq("org_id", orgId).eq("person_id", personId).maybeSingle();
  return (data?.language as string | null) ?? null;
}

/** Sends through the school's own number (never through the suppression-aware send path). */
export async function sendAutoReply(orgId: string, channel: InboundChannel, to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createSupabaseAdminClient();
  const { data: sim } = await admin.from("settings").select("value").eq("org_id", orgId).eq("key", "simulate_sends").maybeSingle();
  if (sim?.value === "true") return { ok: true };
  const cfg = await getChannelConfig(orgId);
  if (channel === "sms") {
    if (!cfg.sms) return { ok: false, error: cfg.smsProblem ?? "SMS isn't configured" };
    const r = await realSenders(cfg).sms({ to, from: cfg.sms.sender, body });
    return r.providerId ? { ok: true } : { ok: false, error: r.error };
  }
  if (!cfg.whatsapp) return { ok: false, error: cfg.whatsappProblem ?? "WhatsApp isn't configured" };
  const r = await getWhatsAppProvider(cfg.whatsapp).sendText(to, body);
  return r.success ? { ok: true } : { ok: false, error: r.error };
}

/** Marks the old per-row status too, so message results and the person page still show "opted out" (this school only). */
async function markLegacyOptOut(admin: SupabaseClient, orgId: string, address: string): Promise<void> {
  const { data } = await admin.from("message_recipients").select("id, messages!inner(org_id)").eq("contact_value", address).eq("messages.org_id", orgId).neq("status", "opted_out").limit(2000);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  for (const part of chunk(ids, 200)) await admin.from("message_recipients").update({ status: "opted_out" }).in("id", part);
}

export async function processInbound(admin: SupabaseClient, ev: InboundEvent, deps: InboundDeps = {}): Promise<InboundOutcome> {
  const now = deps.now ?? new Date();
  const send = deps.sendReply ?? sendAutoReply;
  const address = normalizeFrom(ev.from);
  const { primary, all, hits } = await resolveInboundOrgs(admin, ev, address, now);
  const kw = parseKeyword(ev.body);
  const outcome: InboundOutcome = { orgIds: all, primaryOrgId: primary, keyword: kw?.type ?? null, suppressed: 0, inboundId: null, duplicate: false };

  const personIn = (orgId: string) => hits.find((h) => h.org_id === orgId)?.person_id ?? null;

  const reply = async (orgId: string, kind: ReplyKind): Promise<{ ok: boolean; error?: string }> => {
    const [branding, language] = await Promise.all([loadBrandingSettings(admin, orgId), languageFor(admin, orgId, personIn(orgId))]);
    const contact = branding.replyToEmail || branding.websiteUrl || null;
    return send(orgId, ev.channel, address, autoReplyText(kind, { school: branding.schoolName, contact, language, channel: ev.channel }));
  };

  if (kw?.type === "stop") {
    for (const orgId of all) {
      const { created, id } = await addSuppression(admin, {
        orgId,
        channel: ev.channel,
        address,
        personId: personIn(orgId),
        reason: "stop",
        source: `${ev.channel}_reply`,
        keyword: kw.keyword,
      });
      if (created) outcome.suppressed++;
      await markLegacyOptOut(admin, orgId, address);
      // Exactly one confirmation per opt-out, sent straight away; the dispatcher retries it for five minutes if it fails
      if (id && (created || (await needsConfirmation(admin, id)))) {
        const res = await reply(orgId, "stopped");
        await admin
          .from("suppressions")
          .update({ confirmation_attempts: (await attempts(admin, id)) + 1, ...(res.ok ? { confirmation_sent_at: now.toISOString() } : {}) })
          .eq("id", id);
      }
    }
  } else if (kw?.type === "start") {
    for (const orgId of all) {
      // Only a STOP can be undone by the parent texting START; unsubscribes, complaints and bounces need the school
      const released = await releaseSuppressions(admin, orgId, { channel: ev.channel, address, onlyReasons: ["stop"] }, { reason: `Parent replied ${kw.keyword.toUpperCase()}` });
      if (released > 0) await reply(orgId, "started");
    }
  } else if (kw?.type === "help" && primary) {
    await reply(primary, "help");
  }

  // Every inbound message is kept (keywords included) for the audit trail
  const inboundOrg = primary;
  const matchedRecipient = inboundOrg ? hits.find((h) => h.org_id === inboundOrg) : undefined;
  const { data: row, error } = await admin
    .from("inbound_messages")
    .insert({
      org_id: inboundOrg,
      channel: ev.channel,
      from_number: address,
      to_number: ev.to ? normalizeFrom(ev.to) : "",
      body: ev.body,
      received_at: ev.receivedAt,
      message_recipient_id: matchedRecipient?.id ?? null,
      telnyx_id: ev.providerMessageId,
      raw_payload: ev.raw as object,
    })
    .select("id")
    .single();
  if (error) {
    // 23505: the provider retried a webhook we already handled
    if (error.code === "23505") outcome.duplicate = true;
    else console.error("[inbound] couldn't store inbound message:", error.message);
  } else {
    outcome.inboundId = row.id as string;
    // A reply (not an opt-out) counts as the recipient replying
    if (matchedRecipient && !kw) await admin.from("message_recipients").update({ replied_at: ev.receivedAt }).eq("id", matchedRecipient.id).is("replied_at", null);
    else if (matchedRecipient && kw?.type === "stop") await admin.from("message_recipients").update({ replied_at: ev.receivedAt }).eq("id", matchedRecipient.id).is("replied_at", null);
  }

  // …and the conversation in the inbox. STOP / START appear in every affected school's thread; a real message in the most recent school's.
  try {
    const threadOrgs = kw?.type === "stop" || kw?.type === "start" ? all : kw?.type === "help" ? [] : primary ? [primary] : [];
    for (const orgId of threadOrgs) {
      const recipient = hits.find((h) => h.org_id === orgId);
      await recordInboundThread(admin, {
        orgId,
        personId: recipient?.person_id ?? null,
        address,
        channel: ev.channel,
        body: ev.body,
        providerMessageId: all.length > 1 ? `${ev.providerMessageId}:${orgId}` : ev.providerMessageId,
        receivedAt: ev.receivedAt,
        kind: kw?.type === "stop" ? "optout" : kw?.type === "start" ? "optin" : "message",
        replyToRecipientId: recipient?.id ?? null,
        profileName: ev.profileName,
      });
    }
  } catch (err) {
    console.error("[inbound] couldn't add to the inbox:", err instanceof Error ? err.message : err);
  }
  return outcome;
}

async function needsConfirmation(admin: SupabaseClient, suppressionId: string): Promise<boolean> {
  const { data } = await admin.from("suppressions").select("confirmation_sent_at, confirmation_attempts").eq("id", suppressionId).maybeSingle();
  return !!data && !data.confirmation_sent_at && (data.confirmation_attempts as number) < 3;
}

async function attempts(admin: SupabaseClient, suppressionId: string): Promise<number> {
  const { data } = await admin.from("suppressions").select("confirmation_attempts").eq("id", suppressionId).maybeSingle();
  return (data?.confirmation_attempts as number | undefined) ?? 0;
}

/**
 * Dispatcher: texts the one STOP confirmation again if the first try failed, for
 * up to five minutes after the STOP, three tries at most.
 */
export async function retryPendingConfirmations(admin: SupabaseClient, now: Date = new Date(), send: ReplySender = sendAutoReply): Promise<number> {
  const { data } = await admin
    .from("suppressions")
    .select("id, org_id, channel, address, person_id, confirmation_attempts")
    .is("released_at", null)
    .is("confirmation_sent_at", null)
    .in("source", ["sms_reply", "whatsapp_reply"])
    .gte("created_at", new Date(now.getTime() - 5 * 60_000).toISOString())
    .lt("confirmation_attempts", 3)
    .limit(25);
  let sent = 0;
  for (const s of (data ?? []) as { id: string; org_id: string; channel: InboundChannel; address: string; person_id: string | null; confirmation_attempts: number }[]) {
    const [branding, language] = await Promise.all([loadBrandingSettings(admin, s.org_id), languageFor(admin, s.org_id, s.person_id)]);
    const res = await send(s.org_id, s.channel, s.address, autoReplyText("stopped", { school: branding.schoolName, contact: branding.replyToEmail || branding.websiteUrl || null, language, channel: s.channel }));
    await admin.from("suppressions").update({ confirmation_attempts: s.confirmation_attempts + 1, ...(res.ok ? { confirmation_sent_at: now.toISOString() } : {}) }).eq("id", s.id);
    if (res.ok) sent++;
  }
  return sent;
}
