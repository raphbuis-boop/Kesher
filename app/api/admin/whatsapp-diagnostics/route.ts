/**
 * WhatsApp (Meta Cloud API) diagnostics for the caller's school — owners and admins only.
 *
 * GET  → phone number status, WABA app subscription, template status, plus
 *        which phone number ID / template this school is configured with.
 *        Every Meta response (including error objects) is returned in full.
 * POST → subscribes this app to the school's WABA (POST /{WABA_ID}/subscribed_apps)
 *        so Meta starts delivering status webhooks, and returns Meta's response.
 *
 * The access token is only ever sent in the Authorization header to Meta. It is
 * never returned or logged — the response only says whether it is set.
 */

import { NextResponse } from "next/server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { getChannelConfig } from "@/lib/channels";
import { META_GRAPH_BASE } from "@/lib/meta-whatsapp-provider";

export const dynamic = "force-dynamic";

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

async function requireAdmin(): Promise<{ orgId: string } | NextResponse> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    return { orgId };
  } catch (err) {
    if (err instanceof PermissionError) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const cc = await getChannelConfig(gate.orgId);
  const wa = cc.whatsapp;
  if (!wa) return NextResponse.json({ error: cc.whatsappProblem ?? "WhatsApp isn't set up for this school." }, { status: 400 });

  const cfg = {
    phone_number_id: wa.phoneNumberId,
    waba_id: wa.wabaId,
    access_token_present: true,
    template_name: wa.templateName,
    template_lang: wa.templateLang,
    template_variables: wa.templateVars,
    settings_source: wa.source,
    webhook_verify_token_present: Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
    graph_api_base: META_GRAPH_BASE,
  };
  const token = wa.accessToken;
  const none = (error: string): MetaResult => ({ http_status: null, ok: false, body: { error } });

  const [phoneNumber, phoneHealth, subscribedApps, templates, wabaPhoneNumbers, waba] = await Promise.all([
    metaFetch(`/${wa.phoneNumberId}?fields=${PHONE_FIELDS}`, token),
    // Separate call so an unsupported field can't break the main phone lookup.
    metaFetch(`/${wa.phoneNumberId}?fields=health_status`, token),
    wa.wabaId ? metaFetch(`/${wa.wabaId}/subscribed_apps`, token) : Promise.resolve(none("WABA ID is not set")),
    wa.wabaId ? metaFetch(`/${wa.wabaId}/message_templates?name=${encodeURIComponent(wa.templateName)}`, token) : Promise.resolve(none("WABA ID is not set")),
    wa.wabaId ? metaFetch(`/${wa.wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,status`, token) : Promise.resolve(none("WABA ID is not set")),
    wa.wabaId ? metaFetch(`/${wa.wabaId}?fields=name,account_review_status,health_status`, token) : Promise.resolve(none("WABA ID is not set")),
  ]);

  // Is the configured phone number ID actually one of this WABA's numbers?
  const wabaNumbers = (wabaPhoneNumbers.body as { data?: { id?: string }[] } | null)?.data;
  const phoneNumberInWaba = Array.isArray(wabaNumbers) ? wabaNumbers.some((n) => n.id === wa.phoneNumberId) : null;
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
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const wa = (await getChannelConfig(gate.orgId)).whatsapp;
  if (!wa) return NextResponse.json({ error: "WhatsApp isn't set up for this school." }, { status: 400 });
  if (!wa.wabaId) return NextResponse.json({ error: "Add the WABA ID in Settings → Channels first." }, { status: 400 });

  const subscribe = await metaFetch(`/${wa.wabaId}/subscribed_apps`, wa.accessToken, "POST");
  console.log(`[meta-diagnostics] subscribe org=${gate.orgId} waba=${wa.wabaId} http=${subscribe.http_status} body=${JSON.stringify(subscribe.body)}`);

  // Re-read so the caller sees the resulting subscription list.
  const subscribedApps = await metaFetch(`/${wa.wabaId}/subscribed_apps`, wa.accessToken);
  return NextResponse.json({ waba_id: wa.wabaId, subscribe, subscribed_apps: subscribedApps });
}
