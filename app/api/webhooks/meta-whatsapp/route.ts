/**
 * Meta WhatsApp Cloud API webhook.
 *
 * Handles delivery-status callbacks (sent/delivered/read/failed) and updates
 * message_recipients so the dashboard reflects real delivery state instead of
 * staying on "Sent" forever.
 *
 * Status mapping (message_recipients.status has no DB constraint; by existing
 * convention — mirroring app/api/webhooks/sinch/route.ts — it only ever holds
 * 'sent' | 'delivered' | 'failed' | 'opted_out'; "read" is tracked via the
 * read_at timestamp column, not a status value, same as delivered_at):
 *   sent      → no DB change (already recorded at send time)
 *   delivered → status: "delivered", delivered_at: <ts>   (idempotent, like Sinch)
 *   read      → read_at: <ts> only                        (idempotent)
 *   failed    → status: "failed", error_detail: <from errors[0]>
 *
 * Matching: statuses[].id is the wamid, stored as message_recipients.provider_id
 * at send time (see lib/meta-whatsapp-provider.ts — providerId = messages[0].id).
 *
 * No rollup of messages.sent_count/failed_count — the campaign detail page
 * (app/messages/[id]/CampaignClient.tsx) computes delivered/failed live from
 * message_recipients rows, not from those columns, and the existing Sinch
 * webhook doesn't touch them either; doing so here would diverge from that
 * established pattern rather than align with it.
 *
 * Required env vars:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN — arbitrary string you choose, entered both here
 *   and in Meta App Dashboard → WhatsApp → Configuration → Webhooks when you
 *   register the callback URL.
 *   META_APP_SECRET — Meta App Dashboard → App settings → Basic → App secret.
 *   Every POST must carry a valid X-Hub-Signature-256 made with it; anything else
 *   (or every POST, while it is unset) is rejected with 401 and logged.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { fallbackForFailedRow } from "@/lib/send/engine";
import { processInbound } from "@/lib/inbound";
import { updateThreadMessageStatus } from "@/lib/inbox";
import { metaAppSecrets, verifyMetaSignature } from "@/lib/webhookSecurity";

// ─── GET — Meta's webhook verification challenge ──────────────────────────────

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    console.log("[meta-status] webhook verification succeeded");
    // Meta expects the raw challenge string echoed back as plain text — not JSON.
    return new NextResponse(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  console.error(
    `[meta-status] webhook verification failed — mode=${mode} tokenMatch=${token === expectedToken}`
  );
  return new NextResponse("Forbidden", { status: 403 });
}

// ─── POST — status callbacks (and inbound messages) ────────────────────────────

type MetaStatusError = {
  code?: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
};

type MetaStatus = {
  id?: string;              // wamid — matches SmsResult.providerId from the send
  status?: string;          // "sent" | "delivered" | "read" | "failed"
  timestamp?: string;
  recipient_id?: string;
  errors?: MetaStatusError[];
};

type MetaInboundMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

function inboundText(m: MetaInboundMessage): string {
  return m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? `[${m.type ?? "message"}]`;
}

type MetaWebhookPayload = {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        statuses?: MetaStatus[];
        messages?: MetaInboundMessage[];
      };
    }[];
  }[];
};

// Meta sends timestamps as unix epoch seconds, as a string.
function metaTimestampToIso(ts: string | undefined): string {
  const seconds = Number(ts);
  if (!ts || Number.isNaN(seconds)) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function formatErrorDetail(err: MetaStatusError | undefined): string {
  if (!err) return "WhatsApp delivery failed";
  const parts = [`Meta error ${err.code ?? "?"}: ${err.title ?? "Unknown error"}`];
  if (err.message) parts.push(err.message);
  if (err.error_data?.details) parts.push(`(${err.error_data.details})`);
  return parts.join(" — ");
}

export async function POST(req: NextRequest) {
  const rawBytes = Buffer.from(await req.arrayBuffer());
  const secrets = metaAppSecrets();
  if (secrets.length === 0) {
    console.error("[meta-status] META_APP_SECRET is not set — rejecting POST (set it in Vercel; see DEPLOYMENT.md)");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }
  if (!verifyMetaSignature(rawBytes, req.headers.get("x-hub-signature-256"), secrets)) {
    console.error(`[meta-status] invalid X-Hub-Signature-256 — rejecting POST (bytes=${rawBytes.length}, header=${req.headers.has("x-hub-signature-256") ? "present" : "missing"})`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const rawBody = rawBytes.toString("utf8");

  console.log(`[meta-status] full payload: ${rawBody}`);

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[meta-status] non-JSON payload — skipping parse");
    return NextResponse.json({ ok: true });
  }

  // Ack Meta immediately — it retries (and can eventually disable the webhook) if
  // it doesn't get a fast 200. DB updates run after the response is sent.
  after(() => processPayload(payload));

  return NextResponse.json({ ok: true });
}

async function processPayload(payload: MetaWebhookPayload) {
  try {
    // Basic shape check before touching the DB.
    if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
      console.warn(`[meta-status] unexpected payload shape — object=${payload.object}, skipping`);
      return;
    }

    const supabase = createSupabaseAdminClient();

    for (const entry of payload.entry) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages" || !change.value) continue;

        for (const status of change.value.statuses ?? []) {
          if (!status.id || !status.status) continue;

          const eventTime = metaTimestampToIso(status.timestamp);

          console.log(
            `[meta-status] status update: wamid=${status.id} status=${status.status} recipient=${status.recipient_id} timestamp=${status.timestamp}`
          );

          // Replies sent from the inbox are tracked on the conversation too
          if (status.status === "delivered" || status.status === "read") await updateThreadMessageStatus(supabase, status.id, status.status).catch(() => undefined);
          if (status.status === "failed") await updateThreadMessageStatus(supabase, status.id, "failed", formatErrorDetail(status.errors?.[0])).catch(() => undefined);

          if (status.status === "delivered") {
            const { data: updated, error } = await supabase
              .from("message_recipients")
              .update({ status: "delivered", delivered_at: eventTime })
              .eq("provider_id", status.id)
              .is("delivered_at", null) // idempotent — only set once
              .select("id");

            if (error) {
              console.error(`[meta-status] DB update failed (delivered) wamid=${status.id}:`, error.message);
            } else if (!updated || updated.length === 0) {
              console.warn(`[meta-status] DELIVERED matched no recipient for wamid=${status.id} — already set or provider_id mismatch`);
            }
            continue;
          }

          if (status.status === "read") {
            const { data: updated, error } = await supabase
              .from("message_recipients")
              .update({ read_at: eventTime })
              .eq("provider_id", status.id)
              .is("read_at", null) // idempotent — only set once
              .select("id");

            if (error) {
              console.error(`[meta-status] DB update failed (read) wamid=${status.id}:`, error.message);
            } else if (!updated || updated.length === 0) {
              console.warn(`[meta-status] READ matched no recipient for wamid=${status.id} — already set or provider_id mismatch`);
            }
            continue;
          }

          if (status.status === "failed") {
            const err = status.errors?.[0];
            if (err) {
              console.error(
                `[meta-status] delivery error: wamid=${status.id} code=${err.code} title=${err.title} message=${err.message} details=${err.error_data?.details}`
              );
            }

            const { data: updated, error } = await supabase
              .from("message_recipients")
              .update({ status: "failed", error_detail: formatErrorDetail(err) })
              .eq("provider_id", status.id)
              .select("id");

            if (error) {
              console.error(`[meta-status] DB update failed (failed) wamid=${status.id}:`, error.message);
            } else if (!updated || updated.length === 0) {
              console.warn(`[meta-status] FAILED matched no recipient for wamid=${status.id} — provider_id mismatch`);
            } else {
              // Best-channel messages try the next channel (text, then email) for this parent
              for (const row of updated) {
                try {
                  await fallbackForFailedRow(supabase, row.id as string, formatErrorDetail(err));
                } catch (fbErr) {
                  console.error(`[meta-status] fallback failed for row ${row.id}:`, fbErr instanceof Error ? fbErr.message : fbErr);
                }
              }
            }
            continue;
          }

          // "sent" (and any other/future status values) — no DB change needed.
        }

        // Messages parents send us: STOP and friends are handled per school, everything else is stored for the inbox
        for (const m of change.value.messages ?? []) {
          if (!m.id || !m.from) continue;
          try {
            await processInbound(supabase, {
              channel: "whatsapp",
              from: m.from,
              to: change.value.metadata?.display_phone_number ?? null,
              phoneNumberId: change.value.metadata?.phone_number_id ?? null,
              body: inboundText(m),
              providerMessageId: m.id,
              receivedAt: metaTimestampToIso(m.timestamp),
              raw: m,
              profileName: change.value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null,
            });
          } catch (err) {
            console.error(`[meta-status] inbound processing failed id=${m.id}:`, err instanceof Error ? err.message : err);
          }
        }
      }
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("[meta-status] processing exception:", detail);
  }
}
