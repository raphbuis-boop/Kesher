/**
 * Meta WhatsApp Cloud API webhook — diagnostic only.
 *
 * Purpose: capture delivery-status callbacks (sent/delivered/read/failed) and their
 * error detail so we can see WHY a template message never reaches a recipient's
 * phone, instead of being blind after Meta accepts the send and returns a wamid.
 *
 * This is intentionally minimal — no DB writes, no signature verification, just
 * logging. Wire it into message_recipients later once the failure mode is known.
 *
 * Required env var:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN — arbitrary string you choose, entered both here
 *   and in Meta App Dashboard → WhatsApp → Configuration → Webhooks when you
 *   register the callback URL.
 *
 * Registration: see the setup steps given alongside this file.
 */

import { NextRequest, NextResponse } from "next/server";

// ─── GET — Meta's webhook verification challenge ──────────────────────────────

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    console.log("[meta-status] webhook verification succeeded");
    return new NextResponse(challenge, { status: 200 });
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

type MetaWebhookPayload = {
  object?: string;
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: {
        statuses?: MetaStatus[];
        messages?: unknown[];
      };
    }[];
  }[];
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  console.log(`[meta-status] full payload: ${rawBody}`);

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[meta-status] non-JSON payload — skipping parse");
    return NextResponse.json({ ok: true });
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value?.statuses ?? []) {
        console.log(
          `[meta-status] status update: wamid=${status.id} status=${status.status} recipient=${status.recipient_id} timestamp=${status.timestamp}`
        );

        if (status.errors && status.errors.length > 0) {
          for (const err of status.errors) {
            console.error(
              `[meta-status] delivery error: wamid=${status.id} code=${err.code} title=${err.title} message=${err.message} details=${err.error_data?.details}`
            );
          }
        }
      }

      if (change.value?.messages) {
        console.log(`[meta-status] inbound message(s) received: ${JSON.stringify(change.value.messages)}`);
      }
    }
  }

  // Always ack quickly — Meta retries (and can eventually disable the webhook) if
  // it doesn't get a fast 200.
  return NextResponse.json({ ok: true });
}
