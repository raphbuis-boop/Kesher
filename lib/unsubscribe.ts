import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Email unsubscribe — reuses the SMS opt-out system.
 *
 * SMS STOP marks message_recipients rows as status='opted_out' and every later
 * send skips contact values with an opted_out row. Email uses the exact same
 * mechanism: an unsubscribe marks this address's rows in the sending org as
 * opted_out, and sendEmailBatch suppresses it on future sends.
 *
 * Links carry a signed token for one message_recipients row:
 *   <recipient_id>.<hmac>
 * signed with SUPABASE_SERVICE_ROLE_KEY (server-only, already required by the
 * webhooks), so links can't be forged or enumerated.
 */

function signingKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

function sign(recipientId: string, key: string): string {
  return crypto.createHmac("sha256", key).update(`unsubscribe:${recipientId}`).digest("base64url");
}

/** Absolute origin used in unsubscribe links, or "" if none is configured. */
function unsubscribeBaseUrl(): string {
  const site = getSiteUrl();
  if (site) return site;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "";
}

/** Returns a config error message if unsubscribe links can't be built, else null. */
export function validateUnsubscribeEnv(): string | null {
  if (!signingKey() || !unsubscribeBaseUrl())
    return "Email unsubscribe links are not configured (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SITE_URL). Contact your administrator.";
  return null;
}

/**
 * Builds the two unsubscribe URLs for a recipient row:
 *   page     — human-facing link in the email footer (asks to confirm)
 *   oneClick — RFC 8058 List-Unsubscribe target, accepts POST from Gmail/Yahoo
 */
export function buildUnsubscribeUrls(recipientId: string): { page: string; oneClick: string } {
  const key = signingKey();
  const base = unsubscribeBaseUrl();
  if (!key || !base) throw new Error(validateUnsubscribeEnv() ?? "Unsubscribe not configured");
  const token = encodeURIComponent(`${recipientId}.${sign(recipientId, key)}`);
  return {
    page: `${base}/unsubscribe?t=${token}`,
    oneClick: `${base}/api/unsubscribe?t=${token}`,
  };
}

/** Verifies a token and returns the message_recipients id it was issued for. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  const key = signingKey();
  if (!token || !key) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const recipientId = token.slice(0, dot);
  const expected = Buffer.from(sign(recipientId, key));
  const given = Buffer.from(token.slice(dot + 1));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return recipientId;
}

type RecipientContext = { contactValue: string; orgId: string; schoolName: string };

/** Looks up the address, org and school name behind a recipient row. */
export async function getUnsubscribeContext(recipientId: string): Promise<RecipientContext | null> {
  // Public link with no user session — service-role client, scoped by org_id below
  const supabase = createSupabaseAdminClient();

  const { data: recipient } = await supabase
    .from("message_recipients")
    .select("contact_value, message_id")
    .eq("id", recipientId)
    .maybeSingle();
  if (!recipient) return null;

  const { data: message } = await supabase
    .from("messages")
    .select("org_id")
    .eq("id", recipient.message_id)
    .maybeSingle();
  if (!message) return null;

  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("org_id", message.org_id)
    .eq("key", "school_name")
    .maybeSingle();

  return {
    contactValue: recipient.contact_value as string,
    orgId: message.org_id as string,
    schoolName: (setting?.value as string | undefined)?.trim() || "",
  };
}

/**
 * Opts an email address out of one org's emails: every message_recipients row
 * for that address in that org is marked opted_out (same as SMS STOP).
 * Idempotent.
 */
export async function optOutEmailRecipient(recipientId: string): Promise<RecipientContext | null> {
  const ctx = await getUnsubscribeContext(recipientId);
  if (!ctx) return null;

  const supabase = createSupabaseAdminClient();
  const { data: rows, error: findError } = await supabase
    .from("message_recipients")
    .select("id, messages!inner(org_id)")
    .eq("contact_value", ctx.contactValue)
    .eq("messages.org_id", ctx.orgId)
    .neq("status", "opted_out");

  if (findError) {
    console.error(`[unsubscribe] Failed to find rows for recipient ${recipientId}:`, findError.message);
    throw new Error("Unsubscribe failed");
  }

  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length > 0) {
    const { error } = await supabase
      .from("message_recipients")
      .update({ status: "opted_out" })
      .in("id", ids);
    if (error) {
      console.error(`[unsubscribe] Failed to mark opted_out for recipient ${recipientId}:`, error.message);
      throw new Error("Unsubscribe failed");
    }
  }

  console.log(`[unsubscribe] email opted out — recipient=${recipientId} org=${ctx.orgId} rows=${ids.length}`);
  return ctx;
}
