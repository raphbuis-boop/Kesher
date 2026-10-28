/**
 * The send engine. Runs a message that is already in the database
 * (messages.status = 'sending') and works without a user session, so the same
 * code serves "Send now", scheduled and recurring sends (cron), and the
 * automatic SMS/email fallback when a WhatsApp message fails.
 *
 * Phases
 *   A. Materialize — resolve who gets what (lib/send/recipients.ts) and save
 *      one message_recipients row per message per channel, status 'queued'.
 *      Done once; a re-run sees the rows and skips this.
 *   B. Deliver — claim queued rows (queued → sending, atomically), send, write
 *      the result, queue fallbacks for failures. Resumable: if the function
 *      times out, the message stays 'sending' and the next run (cron, or
 *      "Continue sending") picks up only what's still queued, so nobody gets
 *      a message twice. Email batches carry an idempotency key as well.
 *   C. Finalize — totals + status once nothing is left to send.
 *
 * Every query is filtered by org_id.
 */

import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChannelConfig, type ChannelConfig } from "@/lib/channels";
import { buildEmailHtml, buildEmailText, formatFrom, resolveGreeting, type EmailBranding } from "@/lib/email/render";
import { looksLikeFundraising } from "@/lib/fundraising";
import { buildConfirmUrl } from "@/lib/links";
import { loadBrandingSettings } from "@/lib/settings";
import { applyTemplate, getTemplate, type MessageTemplate } from "@/lib/templates";
import { renderTemplate } from "@/lib/template";
import { childrenLabel } from "@/lib/family";
import { buildUnsubscribeUrls } from "@/lib/unsubscribe";
import { chunk } from "@/lib/supabase-paging";
import { gsmFriendly, SMS_STOP_FOOTER } from "@/lib/sms";
import { addressFor, resolveRecipients } from "./recipients";
import { realSenders, simulatedSenders, type EmailItem, type Senders } from "./senders";
import type { Channel, Child, MessageInput, Person } from "./types";

export type EngineCtx = { supabase: SupabaseClient; orgId: string; senders?: Senders; /** test override */ cfg?: ChannelConfig };

export type ExecuteResult =
  | { state: "skipped"; reason: string }
  | { state: "failed"; error: string }
  | { state: "partial"; sent: number; failed: number; remaining: number }
  | { state: "done"; sent: number; failed: number };

type Row = {
  id: string;
  message_id: string;
  person_id: string;
  contact_value: string;
  name: string;
  status: string;
  channel: Channel | null;
  children: Child[] | null;
  children_label: string | null;
  fallbacks: Channel[] | null;
  provider_id?: string | null;
  claimed_at?: string | null;
};

type MessageRow = {
  id: string;
  org_id: string;
  subject: string | null;
  body: string;
  channel: string;
  status: string;
  template_id: string | null;
  recipient_count: number | null;
  sent_at: string | null;
  payload: MessageInput | null;
  is_fundraising: boolean;
  family_prefix: boolean;
  is_emergency: boolean;
};

const EMAIL_BATCH = 100;
const POOL = 8;
const STALE_CLAIM_MS = 10 * 60_000;
const MEDIA_RE = /\.(jpg|jpeg|png|gif|webp|pdf)$/i;

async function mapPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
      }
    })
  );
}

async function isSimulated(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await supabase.from("settings").select("value").eq("org_id", orgId).eq("key", "simulate_sends").maybeSingle();
  return data?.value === "true";
}

function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();
}

/** Which channels can this school send on right now, for this message? */
export function availableChannels(cfg: ChannelConfig, simulated: boolean, whatsappAllowed: boolean): Record<Channel, boolean> {
  return {
    email: simulated || !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    sms: simulated || !!cfg.sms,
    whatsapp: whatsappAllowed && (simulated || !!cfg.whatsapp),
  };
}

export function whatsappAllowedFor(input: Pick<MessageInput, "isFundraising" | "body" | "subject">): boolean {
  return !input.isFundraising && !looksLikeFundraising(input.body, input.subject);
}

// ─── Phase A ──────────────────────────────────────────────────────────────────

async function materialize(ctx: EngineCtx, msg: MessageRow, input: MessageInput, cfg: ChannelConfig, simulated: boolean): Promise<string | null> {
  const resolution = await resolveRecipients(ctx.supabase, ctx.orgId, {
    audienceSlugs: input.audienceSlugs,
    channels: input.channels,
    channelMode: input.channelMode,
    isEmergency: input.isEmergency,
    studentsDirect: input.studentsDirect,
    excludePersonIds: input.excludePersonIds,
    onlyPersonIds: input.onlyPersonIds,
    familyPrefix: input.familyPrefix,
    available: availableChannels(cfg, simulated, whatsappAllowedFor(input)),
  });

  if (resolution.recipients.length === 0) {
    const e = resolution.excluded;
    const bits = [
      e.opted_out && `${e.opted_out} opted out`,
      e.no_address && `${e.no_address} with no ${input.channels.length === 1 ? (input.channels[0] === "email" ? "email address" : "phone number") : "contact info for these channels"}`,
      e.preference && `${e.preference} turned this off`,
      e.emergency_only && `${e.emergency_only} chose emergency messages only`,
    ].filter(Boolean);
    return `Nobody in this audience can be reached${bits.length ? ` (${bits.join(", ")})` : ""}.`;
  }

  const rows = resolution.recipients.map((r) => ({
    message_id: msg.id,
    person_id: r.person.id,
    contact_value: r.address,
    name: `${r.person.first_name} ${r.person.last_name}`.trim() || r.address,
    status: "queued",
    channel: r.channel,
    children: r.children.length ? r.children : null,
    children_label: r.children.length ? childrenLabel(r.children) : null,
    fallbacks: r.fallbackChannels.length ? r.fallbackChannels : null,
    error_detail: null,
    provider_id: null,
    sent_at: null,
  }));
  for (const part of chunk(rows, 400)) {
    const { error } = await ctx.supabase.from("message_recipients").insert(part);
    if (error) throw new Error(`Couldn't save the recipient list: ${error.message}`);
  }
  await ctx.supabase.from("messages").update({ recipient_count: rows.length }).eq("org_id", ctx.orgId).eq("id", msg.id);
  return null;
}

// ─── Rendering one recipient's message ────────────────────────────────────────

type RenderCtx = {
  input: MessageInput;
  msg: MessageRow;
  cfg: ChannelConfig;
  template: MessageTemplate | null;
  branding: EmailBranding;
  fromHeader: string;
  replyTo?: string;
  senderLabel: string;
};

function personContext(person: Person, children: Child[]) {
  return { ...person, children };
}

function familyLine(ctx: RenderCtx, children: Child[]): string | null {
  return ctx.input.familyPrefix && children.length > 0 ? `For ${childrenLabel(children)}` : null;
}

function emailItem(ctx: RenderCtx, row: Row, person: Person, children: Child[]): EmailItem {
  const rendered = renderTemplate(ctx.input.body, personContext(person, children));
  const firstName = person.preferred_name?.trim() || person.first_name?.trim() || null;
  const unsubscribe = buildUnsubscribeUrls(row.id);
  const confirmUrl = ctx.input.confirmButton ? buildConfirmUrl(row.id) : null;
  const content = {
    body: rendered,
    greeting: resolveGreeting(ctx.input.greeting, firstName),
    familyLine: familyLine(ctx, children),
    attachmentUrls: ctx.input.attachmentUrls,
    unsubscribeUrl: unsubscribe.page,
    confirmUrl,
  };
  return {
    to: row.contact_value,
    subject: renderTemplate(ctx.input.subject, personContext(person, children)),
    html: buildEmailHtml(content, ctx.branding),
    text: buildEmailText(content, ctx.branding),
    headers: {
      // Helps Gmail and Outlook route bulk mail correctly
      Precedence: "bulk",
      // Unique per-recipient ID prevents duplicate-detection false positives
      "X-Entity-Ref-ID": `${ctx.msg.id}-${row.id}`,
      // RFC 8058 one-click unsubscribe — required by Gmail/Yahoo bulk sender rules.
      "List-Unsubscribe": `<${unsubscribe.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

function textBody(ctx: RenderCtx, row: Row, person: Person, children: Child[], channel: "sms" | "whatsapp"): string {
  let body = renderTemplate(ctx.input.body, personContext(person, children));
  const line = familyLine(ctx, children);
  if (line) body = `${line}: ${body}`;
  const confirmUrl = ctx.input.confirmButton ? buildConfirmUrl(row.id) : null;
  if (confirmUrl) body += `\n\nTap to say you've read this: ${confirmUrl}`;
  // CTIA requires an opt-out instruction in every SMS. WhatsApp's template carries its own.
  return channel === "sms" ? gsmFriendly(body) + SMS_STOP_FOOTER : body;
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

/** Queue the next channel for a failed row (best-channel mode). Returns true if a fallback row was created. */
async function queueFallback(ctx: EngineCtx, row: Row, person: Person | undefined, reason: string): Promise<boolean> {
  const fallbacks = row.fallbacks ?? [];
  if (!person || fallbacks.length === 0) return false;
  for (let i = 0; i < fallbacks.length; i++) {
    const next = fallbacks[i];
    const address = addressFor(person, next);
    if (!address) continue;
    const { error } = await ctx.supabase.from("message_recipients").insert({
      message_id: row.message_id,
      person_id: row.person_id,
      contact_value: address,
      name: row.name,
      status: "queued",
      channel: next,
      children: row.children,
      children_label: row.children_label,
      fallbacks: fallbacks.slice(i + 1).length ? fallbacks.slice(i + 1) : null,
      fallback_of: row.id,
      error_detail: null,
      provider_id: null,
      sent_at: null,
    });
    // 23505: this failed row already has its fallback (duplicate webhook) — fine
    if (error && error.code !== "23505") {
      console.error(`[send] fallback insert failed for row ${row.id}:`, error.message);
      return false;
    }
    await ctx.supabase
      .from("message_recipients")
      .update({ error_detail: `${reason} — trying ${next === "sms" ? "text" : next} instead` })
      .eq("id", row.id);
    return true;
  }
  return false;
}

/**
 * A WhatsApp (or SMS) message failed after we'd handed it over — Meta/Sinch
 * tell us later via webhook. In best-channel mode, queue the next channel and
 * send it. Safe to call twice for the same row.
 */
export async function fallbackForFailedRow(supabase: SupabaseClient, rowId: string, reason: string): Promise<void> {
  const { data: rowData } = await supabase
    .from("message_recipients")
    .select("id, message_id, person_id, contact_value, name, status, channel, children, children_label, fallbacks, messages!inner(org_id, channel_mode)")
    .eq("id", rowId)
    .maybeSingle();
  const row = rowData as unknown as (Row & { messages: { org_id: string; channel_mode: string } }) | null;
  if (!row || row.messages.channel_mode !== "best" || !(row.fallbacks?.length)) return;
  const orgId = row.messages.org_id;
  const ctx: EngineCtx = { supabase, orgId };
  const { data: person } = await supabase
    .from("people")
    .select("id, first_name, last_name, preferred_name, salutation, email, phone, whatsapp, grade, graduation_year, categories, custom_fields")
    .eq("org_id", orgId)
    .eq("id", row.person_id)
    .maybeSingle();
  if (!(await queueFallback(ctx, row, (person as Person | null) ?? undefined, reason))) return;
  // Reopen the (already finished) message for the one new row
  await supabase.from("messages").update({ status: "sending" }).eq("org_id", orgId).eq("id", row.message_id).in("status", ["sent", "failed"]);
  await executeMessage(ctx, row.message_id, { deadlineMs: Date.now() + 25_000 });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function executeMessage(ctx: EngineCtx, messageId: string, opts: { deadlineMs?: number } = {}): Promise<ExecuteResult> {
  const deadline = opts.deadlineMs ?? Date.now() + 50_000;
  const { supabase, orgId } = ctx;

  const { data: msgData } = await supabase
    .from("messages")
    .select("id, org_id, subject, body, channel, status, template_id, recipient_count, sent_at, payload, is_fundraising, family_prefix, is_emergency")
    .eq("org_id", orgId)
    .eq("id", messageId)
    .maybeSingle();
  const msg = msgData as MessageRow | null;
  if (!msg) return { state: "skipped", reason: "Message not found" };
  if (msg.status !== "sending") return { state: "skipped", reason: `Message is ${msg.status}` };
  if (!msg.payload) return { state: "failed", error: "This message has no send settings saved." };
  const input = msg.payload;

  const failMessage = async (error: string): Promise<ExecuteResult> => {
    await supabase.from("messages").update({ status: "failed", sent_count: 0, failed_count: 0, error_detail: error }).eq("org_id", orgId).eq("id", messageId);
    return { state: "failed", error };
  };

  try {
    const [cfg, simulated, template, baseBranding] = await Promise.all([
      ctx.cfg ? Promise.resolve(ctx.cfg) : getChannelConfig(orgId),
      isSimulated(supabase, orgId),
      getTemplate(supabase, orgId, msg.template_id),
      loadBrandingSettings(supabase, orgId),
    ]);

    // ── Phase A ──
    const { count: existing } = await supabase.from("message_recipients").select("id", { count: "exact", head: true }).eq("message_id", messageId);
    if ((existing ?? 0) === 0) {
      const problem = await materialize(ctx, msg, input, cfg, simulated);
      if (problem) return failMessage(problem);
    }

    // ── Branding / sender ──
    const branding = applyTemplate(baseBranding, template);
    const defaultFrom = process.env.RESEND_FROM_EMAIL ?? "";
    const senderOnVerifiedDomain = !!branding.senderEmail && !!defaultFrom && emailDomain(branding.senderEmail) === emailDomain(defaultFrom);
    const fromEmail = senderOnVerifiedDomain ? branding.senderEmail : defaultFrom;
    const configuredName = branding.senderName?.trim().toLowerCase() === "kesher" ? "" : branding.senderName;
    const fromName = configuredName || branding.schoolName || "";
    const rctx: RenderCtx = {
      input,
      msg,
      cfg,
      template,
      branding,
      fromHeader: formatFrom(fromName, fromEmail),
      replyTo: branding.replyToEmail || (branding.senderEmail && !senderOnVerifiedDomain ? branding.senderEmail : "") || undefined,
      senderLabel: template?.sender_name?.trim() || baseBranding.schoolName || "Your school",
    };
    const senders = ctx.senders ?? (simulated ? simulatedSenders() : realSenders(cfg));

    // ── Phase B ──
    // A crashed worker's claims expire, so its rows get picked up again
    await supabase
      .from("message_recipients")
      .update({ status: "queued", claimed_at: null })
      .eq("message_id", messageId)
      .eq("status", "sending")
      .lt("claimed_at", new Date(Date.now() - STALE_CLAIM_MS).toISOString());

    const people = new Map<string, Person>();
    const loadPeople = async (ids: string[]) => {
      const missing = [...new Set(ids)].filter((id) => !people.has(id));
      for (const part of chunk(missing, 150)) {
        const { data } = await supabase
          .from("people")
          .select("id, first_name, last_name, preferred_name, salutation, email, phone, whatsapp, grade, graduation_year, categories, custom_fields")
          .eq("org_id", orgId)
          .in("id", part);
        for (const p of (data ?? []) as Person[]) people.set(p.id, p);
      }
    };

    const claim = async (channel: Channel, limit: number): Promise<Row[]> => {
      const { data: ids } = await supabase
        .from("message_recipients")
        .select("id")
        .eq("message_id", messageId)
        .eq("status", "queued")
        .eq("channel", channel)
        .order("id")
        .limit(limit);
      const wanted = ((ids ?? []) as { id: string }[]).map((r) => r.id);
      if (wanted.length === 0) return [];
      const { data } = await supabase
        .from("message_recipients")
        .update({ status: "sending", claimed_at: new Date().toISOString() })
        .eq("message_id", messageId)
        .eq("status", "queued")
        .in("id", wanted)
        .select("id, message_id, person_id, contact_value, name, status, channel, children, children_label, fallbacks");
      return (data ?? []) as Row[];
    };

    const writeResults = async (results: { row: Row; providerId: string | null; error?: string }[]) => {
      const now = new Date().toISOString();
      const payload = results.map(({ row, providerId, error }) => ({
        id: row.id,
        message_id: row.message_id,
        person_id: row.person_id,
        contact_value: row.contact_value,
        name: row.name,
        status: providerId ? "sent" : "failed",
        provider_id: providerId,
        sent_at: providerId ? now : null,
        error_detail: providerId ? null : (error ?? "Send did not complete"),
      }));
      for (const part of chunk(payload, 200)) {
        const { error } = await supabase.from("message_recipients").upsert(part, { onConflict: "id" });
        if (error) console.error(`[send] ${messageId}: could not save results:`, error.message);
      }
      // Immediate failures fall back to the next channel in best-channel mode
      for (const { row, providerId, error } of results) {
        if (!providerId && row.fallbacks?.length) await queueFallback(ctx, row, people.get(row.person_id), error ?? "Send failed");
      }
    };

    const channelOrder: Channel[] = ["email", "whatsapp", "sms"];
    let guard = 0;
    while (Date.now() < deadline && guard++ < 500) {
      let worked = false;
      for (const channel of channelOrder) {
        if (Date.now() >= deadline) break;
        const rows = await claim(channel, channel === "email" ? EMAIL_BATCH : 40);
        if (rows.length === 0) continue;
        worked = true;
        await loadPeople(rows.map((r) => r.person_id));

        if (channel === "email") {
          const items: { row: Row; item: EmailItem }[] = [];
          const failed: { row: Row; providerId: null; error: string }[] = [];
          for (const row of rows) {
            const person = people.get(row.person_id);
            if (!person) {
              failed.push({ row, providerId: null, error: "Contact no longer exists" });
              continue;
            }
            items.push({ row, item: emailItem(rctx, row, person, row.children ?? []) });
          }
          if (items.length > 0) {
            const key = crypto.createHash("sha256").update(`${messageId}:${items.map((i) => i.row.id).sort().join(",")}`).digest("hex").slice(0, 48);
            let res: { error?: string; ids: (string | null)[] };
            try {
              res = await senders.email({ from: rctx.fromHeader, replyTo: rctx.replyTo, items: items.map((i) => i.item), idempotencyKey: key });
            } catch (err) {
              res = { error: err instanceof Error ? err.message : "Email send failed", ids: items.map(() => null) };
            }
            await writeResults([
              ...items.map(({ row }, i) => ({ row, providerId: res.ids[i] ?? null, error: res.error ?? "Resend did not return a message ID" })),
              ...failed,
            ]);
          } else await writeResults(failed);
        } else {
          const results: { row: Row; providerId: string | null; error?: string }[] = [];
          await mapPool(rows, POOL, async (row) => {
            const person = people.get(row.person_id);
            if (!person) {
              results.push({ row, providerId: null, error: "Contact no longer exists" });
              return;
            }
            const body = textBody(rctx, row, person, row.children ?? [], channel);
            try {
              const r =
                channel === "sms"
                  ? await senders.sms({ to: row.contact_value, from: cfg.sms?.sender ?? "", body })
                  : await senders.whatsapp({
                      to: row.contact_value,
                      body,
                      label: rctx.senderLabel,
                      mediaUrl: input.attachmentUrls.find((u) => MEDIA_RE.test(u)),
                    });
              results.push({ row, providerId: r.providerId, error: r.error });
            } catch (err) {
              results.push({ row, providerId: null, error: err instanceof Error ? err.message : "Send failed" });
            }
          });
          await writeResults(results);
        }
      }
      if (!worked) break;
    }

    // ── Phase C ──
    const { count: remaining } = await supabase
      .from("message_recipients")
      .select("id", { count: "exact", head: true })
      .eq("message_id", messageId)
      .in("status", ["queued", "sending"]);
    const stats = await messageStats(supabase, messageId);
    if ((remaining ?? 0) > 0) {
      await supabase.from("messages").update({ sent_count: stats.sent, failed_count: stats.failed }).eq("org_id", orgId).eq("id", messageId);
      return { state: "partial", sent: stats.sent, failed: stats.failed, remaining: remaining ?? 0 };
    }
    const status = stats.sent === 0 ? "failed" : "sent";
    await supabase
      .from("messages")
      .update({
        status,
        sent_count: stats.sent,
        failed_count: stats.failed,
        sent_at: msg.sent_at ?? new Date().toISOString(),
        error_detail: stats.sent === 0 ? (stats.firstError ?? "All sends failed") : null,
      })
      .eq("org_id", orgId)
      .eq("id", messageId);
    return { state: "done", sent: stats.sent, failed: stats.failed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[send] ${messageId} crashed:`, message);
    // Leave the message 'sending': queued rows are intact and the next run resumes them
    return { state: "failed", error: message };
  }
}

/** Sent = handed to a provider; failed = failed with no successful fallback. */
async function messageStats(supabase: SupabaseClient, messageId: string): Promise<{ sent: number; failed: number; firstError: string | null }> {
  const rows: { id: string; status: string; fallback_of: string | null; error_detail: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("message_recipients")
      .select("id, status, fallback_of, error_detail")
      .eq("message_id", messageId)
      .order("id")
      .range(from, from + 999);
    rows.push(...((data ?? []) as typeof rows));
    if (!data || data.length < 1000) break;
  }
  const hasFallback = new Set(rows.map((r) => r.fallback_of).filter((x): x is string => !!x));
  const sent = rows.filter((r) => r.status === "sent" || r.status === "delivered").length;
  const failedRows = rows.filter((r) => r.status === "failed" && !hasFallback.has(r.id));
  return { sent, failed: failedRows.length, firstError: failedRows.find((r) => r.error_detail)?.error_detail ?? null };
}
