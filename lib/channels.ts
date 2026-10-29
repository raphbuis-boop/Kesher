/**
 * Per-school channel configuration (WhatsApp + SMS).
 *
 * Each school stores its own WhatsApp phone number ID / WABA ID / display name
 * / template, and SMS sender in org_channels; its WhatsApp access token is
 * AES-encrypted in org_secrets (service-role only). Schools with
 * use_env_defaults = true (everyone who existed when this shipped) fall back
 * field-by-field to the old global env vars, so nothing breaks. New schools
 * never fall back — they can't send from another school's number.
 *
 * Server-only. Uses the service-role client because it also runs in cron and
 * webhook contexts; every query is filtered by the org_id passed in, which
 * the caller has already authorized.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { decryptSecret, encryptSecret, hasEncryptionKey } from "@/lib/crypto";

export type WhatsAppConfig = {
  phoneNumberId: string;
  wabaId: string | null;
  displayName: string | null;
  templateName: string;
  templateLang: string;
  /** 1 = body only; 2 = {{1}} school/group name + {{2}} message body */
  templateVars: 1 | 2;
  accessToken: string;
  source: "org" | "platform";
};

export type SmsConfig = { sender: string; source: "org" | "platform" };

export type ChannelConfig = {
  whatsapp: WhatsAppConfig | null;
  sms: SmsConfig | null;
  /** What's missing for each channel, in plain words (null when complete). */
  whatsappProblem: string | null;
  smsProblem: string | null;
  usesPlatformDefaults: boolean;
};

/** The WABA this platform has used so far; only applied to schools on platform defaults. */
const PLATFORM_DEFAULT_WABA = "3026577834341321";

export type Row = {
  use_env_defaults: boolean;
  whatsapp_phone_number_id: string | null;
  whatsapp_waba_id: string | null;
  whatsapp_display_name: string | null;
  whatsapp_template_name: string | null;
  whatsapp_template_lang: string | null;
  whatsapp_template_vars: number | null;
  sms_sender: string | null;
};

const COLUMNS =
  "use_env_defaults, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_display_name, whatsapp_template_name, whatsapp_template_lang, whatsapp_template_vars, sms_sender";

const blank = (v: string | null | undefined) => (v ?? "").trim();

export async function getChannelConfig(orgId: string): Promise<ChannelConfig> {
  const admin = createSupabaseAdminClient();
  const [{ data: rowData }, { data: secretData }] = await Promise.all([
    admin.from("org_channels").select(COLUMNS).eq("org_id", orgId).maybeSingle(),
    admin.from("org_secrets").select("value_enc").eq("org_id", orgId).eq("key", "whatsapp_token").maybeSingle(),
  ]);
  let token: string | null = null;
  if (secretData?.value_enc) {
    try {
      token = decryptSecret(secretData.value_enc as string);
    } catch (err) {
      console.error(`[channels] could not decrypt WhatsApp token for org ${orgId}:`, err instanceof Error ? err.message : err);
    }
  }
  return resolveChannelConfig((rowData as Row | null) ?? null, token, process.env);
}

/**
 * Pure resolution rules (unit-tested): a school's own values win; blanks fall
 * back to the platform env vars ONLY when use_env_defaults is true.
 */
export function resolveChannelConfig(row: Row | null, orgToken: string | null, envVars: Record<string, string | undefined>): ChannelConfig {
  const env = !!row?.use_env_defaults;
  const fromEnv = (name: string) => (env ? blank(envVars[name]) : "");

  // ── WhatsApp ──
  const phoneNumberId = blank(row?.whatsapp_phone_number_id) || fromEnv("META_WHATSAPP_PHONE_NUMBER_ID");
  const templateName = blank(row?.whatsapp_template_name) || fromEnv("META_WHATSAPP_TEMPLATE_NAME");
  const token = orgToken || fromEnv("META_WHATSAPP_ACCESS_TOKEN");

  const missing = [!phoneNumberId && "phone number ID", !token && "access token", !templateName && "template name"].filter(Boolean);
  const whatsappProblem = missing.length ? `WhatsApp isn't set up yet — missing the ${missing.join(", ")}.` : null;
  const whatsapp: WhatsAppConfig | null = whatsappProblem
    ? null
    : {
        phoneNumberId,
        wabaId: blank(row?.whatsapp_waba_id) || (env ? fromEnv("META_WHATSAPP_WABA_ID") || PLATFORM_DEFAULT_WABA : "") || null,
        displayName: blank(row?.whatsapp_display_name) || null,
        templateName,
        templateLang: blank(row?.whatsapp_template_lang) || fromEnv("META_WHATSAPP_TEMPLATE_LANG") || "en_US",
        templateVars: row?.whatsapp_template_vars === 2 ? 2 : 1,
        accessToken: token,
        source: blank(row?.whatsapp_phone_number_id) && orgToken ? "org" : "platform",
      };

  // ── SMS (Sinch project credentials are platform-level; the sender number is the school's) ──
  const sender = blank(row?.sms_sender) || fromEnv("SINCH_SMS_SENDER");
  const hasSinch = !!(envVars.SINCH_PROJECT_ID && envVars.SINCH_APP_ID && envVars.SINCH_ACCESS_KEY && envVars.SINCH_ACCESS_SECRET);
  const smsProblem = !hasSinch ? "SMS delivery isn't configured on this server." : !sender ? "No SMS sender number is set for this school." : null;

  return {
    whatsapp,
    sms: smsProblem ? null : { sender, source: blank(row?.sms_sender) ? "org" : "platform" },
    whatsappProblem,
    smsProblem,
    usesPlatformDefaults: env,
  };
}

// ─── Writes (server actions call these after checking the caller is an admin) ──

export type WhatsAppInput = {
  phoneNumberId: string;
  wabaId: string;
  displayName: string;
  templateName: string;
  templateLang: string;
  templateVars: 1 | 2;
  /** Only set when replacing the token; blank keeps the saved one. */
  accessToken?: string;
};

export async function saveWhatsAppConfig(orgId: string, input: WhatsAppInput): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("org_channels").upsert(
    {
      org_id: orgId,
      whatsapp_phone_number_id: input.phoneNumberId || null,
      whatsapp_waba_id: input.wabaId || null,
      whatsapp_display_name: input.displayName || null,
      whatsapp_template_name: input.templateName || null,
      whatsapp_template_lang: input.templateLang || "en_US",
      whatsapp_template_vars: input.templateVars,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );
  if (error) throw new Error(error.message);

  if (input.accessToken?.trim()) {
    if (!hasEncryptionKey()) throw new Error("KESHER_ENCRYPTION_KEY isn't set on the server, so the access token can't be stored securely.");
    const { error: secretError } = await admin
      .from("org_secrets")
      .upsert({ org_id: orgId, key: "whatsapp_token", value_enc: encryptSecret(input.accessToken.trim()), updated_at: new Date().toISOString() }, { onConflict: "org_id,key" });
    if (secretError) throw new Error(secretError.message);
  }
}

export async function saveSmsSender(orgId: string, sender: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("org_channels")
    .upsert({ org_id: orgId, sms_sender: sender || null, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
}

export async function clearWhatsAppToken(orgId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from("org_secrets").delete().eq("org_id", orgId).eq("key", "whatsapp_token");
}

/** True if this school has its own saved token (the token itself is never returned). */
export async function hasOrgWhatsAppToken(orgId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("org_secrets").select("key").eq("org_id", orgId).eq("key", "whatsapp_token").maybeSingle();
  return !!data;
}
