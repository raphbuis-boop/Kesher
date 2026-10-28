/**
 * WhatsApp (Meta Cloud API) diagnostics — logged-in users only.
 *
 * GET  → phone number status, WABA app subscription, template status, plus which
 *        phone number ID / template the server is configured with. Every Meta
 *        response (including error objects) is returned in full.
 * POST → subscribes this app to the WABA (POST /{WABA_ID}/subscribed_apps) so
 *        Meta starts delivering status webhooks, and returns Meta's response.
 *
 * The access token is only ever sent in the Authorization header to Meta. It is
 * never returned or logged — the response only says whether it is set.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { META_GRAPH_BASE } from "@/lib/meta-whatsapp-provider";

export const dynamic = "force-dynamic";

const WABA_ID = process.env.META_WHATSAPP_WABA_ID || "3026577834341321";
const EXPECTED_PHONE_NUMBER_ID = "1268318203034692";

const PHONE_FIELDS = [
  "display_phone_number",
  "verified_name",
  "name_status",
  "status",
  "quality_rating",
  "code_verification_status",
  "messaging_limit_tier",
  "throughput",
  "platform_type",
].join(",");

type MetaResult = { http_status: number | null; ok: boolean; body: unknown };

async function metaFetch(path: string, token: string, method: "GET" | "POST" = "GET"): Promise<MetaResult> {
  try {
    const res = await fetch(`${META_GRAPH_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { non_json_body: text.slice(0, 2000) };
    }
    return { http_status: res.status, ok: res.ok, body };
  } catch (err) {
    return { http_status: null, ok: false, body: { network_error: err instanceof Error ? err.message : String(err) } };
  }
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function config() {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? null;
  return {
    phone_number_id: phoneNumberId,
    phone_number_id_matches_expected: phoneNumberId === EXPECTED_PHONE_NUMBER_ID,
    expected_phone_number_id: EXPECTED_PHONE_NUMBER_ID,
    waba_id: WABA_ID,
    access_token_present: Boolean(process.env.META_WHATSAPP_ACCESS_TOKEN),
    template_name: process.env.META_WHATSAPP_TEMPLATE_NAME ?? null,
    template_lang: process.env.META_WHATSAPP_TEMPLATE_LANG || "en_US",
    webhook_verify_token_present: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    graph_api_base: META_GRAPH_BASE,
  };
}

export async function GET() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const cfg = config();
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ config: cfg, error: "META_WHATSAPP_ACCESS_TOKEN is not set" }, { status: 500 });
  }

  const templateName = cfg.template_name ?? "school_announcement";

  const [phoneNumber, phoneHealth, subscribedApps, templates, wabaPhoneNumbers, waba] = await Promise.all([
    cfg.phone_number_id
      ? metaFetch(`/${cfg.phone_number_id}?fields=${PHONE_FIELDS}`, token)
      : Promise.resolve<MetaResult>({ http_status: null, ok: false, body: { error: "META_WHATSAPP_PHONE_NUMBER_ID is not set" } }),
    // Separate call so an unsupported field can't break the main phone lookup.
    cfg.phone_number_id
      ? metaFetch(`/${cfg.phone_number_id}?fields=health_status`, token)
      : Promise.resolve<MetaResult>({ http_status: null, ok: false, body: null }),
    metaFetch(`/${WABA_ID}/subscribed_apps`, token),
    metaFetch(`/${WABA_ID}/message_templates?name=${encodeURIComponent(templateName)}`, token),
    metaFetch(`/${WABA_ID}/phone_numbers?fields=id,display_phone_number,verified_name,status`, token),
    metaFetch(`/${WABA_ID}?fields=name,account_review_status,health_status`, token),
  ]);

  // Is the configured phone number ID actually one of this WABA's numbers?
  const wabaNumbers = (wabaPhoneNumbers.body as { data?: { id?: string }[] } | null)?.data;
  const phoneNumberInWaba = Array.isArray(wabaNumbers)
    ? wabaNumbers.some((n) => n.id === cfg.phone_number_id)
    : null;

  const subscribed = (subscribedApps.body as { data?: unknown[] } | null)?.data;

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    config: cfg,
    summary: {
      phone_number_in_waba: phoneNumberInWaba,
      app_subscribed_to_waba: Array.isArray(subscribed) ? subscribed.length > 0 : null,
    },
    phone_number: phoneNumber,
    phone_health_status: phoneHealth,
    subscribed_apps: subscribedApps,
    template: templates,
    waba_phone_numbers: wabaPhoneNumbers,
    waba,
  });
}

export async function POST() {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "META_WHATSAPP_ACCESS_TOKEN is not set" }, { status: 500 });
  }

  const subscribe = await metaFetch(`/${WABA_ID}/subscribed_apps`, token, "POST");
  console.log(`[meta-diagnostics] subscribe waba=${WABA_ID} http=${subscribe.http_status} body=${JSON.stringify(subscribe.body)}`);

  // Re-read so the caller sees the resulting subscription list.
  const subscribedApps = await metaFetch(`/${WABA_ID}/subscribed_apps`, token);

  return NextResponse.json({ waba_id: WABA_ID, subscribe, subscribed_apps: subscribedApps });
}
