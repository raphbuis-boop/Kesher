import { getChannelConfig, hasOrgWhatsAppToken, type ChannelConfig, type WhatsAppConfig } from "@/lib/channels";
import { META_GRAPH_BASE } from "@/lib/meta-whatsapp-provider";

/** Connection status for each sending channel — never includes a secret. */
export type ChannelState = "connected" | "not_connected" | "attention";

export type ChannelStatus = {
  key: "email" | "sms" | "whatsapp";
  label: string;
  state: ChannelState;
  detail: { label: string; value: string }[];
  /** Plain-words explanation when state isn't "connected". */
  problem: string | null;
};

export type WhatsAppTemplateInfo = {
  name: string;
  language: string;
  /** UTILITY / MARKETING / AUTHENTICATION */
  category: string | null;
  /** APPROVED / PENDING / REJECTED / PAUSED / DISABLED … or "NOT_FOUND" / "UNKNOWN" */
  status: string;
  bodyText: string | null;
  variables: number | null;
};

export type WhatsAppLive = {
  number: string;
  verifiedName: string;
  quality: string | null;
  phoneStatus: string | null;
  template: WhatsAppTemplateInfo | null;
  /** Set when Meta couldn't be reached or rejected the token. */
  error: string | null;
};

type Json = Record<string, unknown>;

async function graph(path: string, token: string, fresh: boolean): Promise<{ ok: boolean; status: number; json: Json }> {
  try {
    const res = await fetch(`${META_GRAPH_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3500),
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
    });
    return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Json };
  } catch (err) {
    return { ok: false, status: 0, json: { error: { message: err instanceof Error ? err.message : "Network error" } } };
  }
}

const metaError = (j: Json) => ((j.error as { message?: string } | undefined)?.message ?? "Meta didn't answer.");

/** Asks Meta about this school's number and template. `fresh` skips the 5-minute cache. */
export async function getWhatsAppLive(cfg: WhatsAppConfig, fresh = false): Promise<WhatsAppLive> {
  const [phone, templates] = await Promise.all([
    graph(`/${encodeURIComponent(cfg.phoneNumberId)}?fields=display_phone_number,verified_name,quality_rating,status`, cfg.accessToken, fresh),
    cfg.wabaId
      ? graph(
          `/${encodeURIComponent(cfg.wabaId)}/message_templates?name=${encodeURIComponent(cfg.templateName)}&fields=name,status,category,language,components&limit=10`,
          cfg.accessToken,
          fresh
        )
      : Promise.resolve(null),
  ]);

  let template: WhatsAppTemplateInfo | null = null;
  if (templates) {
    if (templates.ok) {
      const rows = ((templates.json.data as Json[] | undefined) ?? []).filter((t) => t.name === cfg.templateName);
      const row = rows.find((t) => t.language === cfg.templateLang) ?? rows[0];
      if (row) {
        const body = ((row.components as Json[] | undefined) ?? []).find((c) => c.type === "BODY");
        const text = (body?.text as string | undefined) ?? null;
        template = {
          name: cfg.templateName,
          language: String(row.language ?? cfg.templateLang),
          category: (row.category as string | undefined) ?? null,
          status: String(row.status ?? "UNKNOWN"),
          bodyText: text,
          variables: text ? new Set(text.match(/\{\{\d+\}\}/g) ?? []).size : null,
        };
      } else {
        template = { name: cfg.templateName, language: cfg.templateLang, category: null, status: "NOT_FOUND", bodyText: null, variables: null };
      }
    }
  }

  const error = !phone.ok ? (phone.status === 0 ? "Couldn't reach Meta to check this number." : `Meta says: ${metaError(phone.json)}`) : null;
  return {
    number: (phone.json.display_phone_number as string | undefined) ?? "",
    verifiedName: (phone.json.verified_name as string | undefined) ?? "",
    quality: (phone.json.quality_rating as string | undefined) ?? null,
    phoneStatus: (phone.json.status as string | undefined) ?? null,
    template,
    error,
  };
}

export type ChannelsOverview = {
  statuses: ChannelStatus[];
  /** What to show in the editable forms (never the token). */
  form: {
    whatsapp: {
      phoneNumberId: string;
      wabaId: string;
      displayName: string;
      templateName: string;
      templateLang: string;
      templateVars: 1 | 2;
      hasOwnToken: boolean;
    };
    smsSender: string;
    usesPlatformDefaults: boolean;
  };
  live: WhatsAppLive | null;
};

export async function getChannelsOverview(orgId: string, branding: { schoolName: string; senderName: string; senderEmail: string }): Promise<ChannelsOverview> {
  const [cfg, hasOwnToken] = await Promise.all([getChannelConfig(orgId), hasOrgWhatsAppToken(orgId)]);
  const live = cfg.whatsapp ? await getWhatsAppLive(cfg.whatsapp) : null;
  return { statuses: buildStatuses(cfg, live, branding), form: await formValues(orgId, cfg, hasOwnToken), live };
}

async function formValues(orgId: string, cfg: ChannelConfig, hasOwnToken: boolean): Promise<ChannelsOverview["form"]> {
  // Show what's actually in use (including platform defaults) so admins see the real values
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const { data } = await createSupabaseAdminClient()
    .from("org_channels")
    .select("whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_display_name, whatsapp_template_name, whatsapp_template_lang, whatsapp_template_vars, sms_sender")
    .eq("org_id", orgId)
    .maybeSingle();
  const row = (data ?? {}) as Record<string, string | number | null>;
  return {
    whatsapp: {
      phoneNumberId: String(row.whatsapp_phone_number_id ?? cfg.whatsapp?.phoneNumberId ?? ""),
      wabaId: String(row.whatsapp_waba_id ?? cfg.whatsapp?.wabaId ?? ""),
      displayName: String(row.whatsapp_display_name ?? ""),
      templateName: String(row.whatsapp_template_name ?? cfg.whatsapp?.templateName ?? ""),
      templateLang: String(row.whatsapp_template_lang ?? cfg.whatsapp?.templateLang ?? "en_US"),
      templateVars: row.whatsapp_template_vars === 2 ? 2 : 1,
      hasOwnToken,
    },
    smsSender: String(row.sms_sender ?? cfg.sms?.sender ?? ""),
    usesPlatformDefaults: cfg.usesPlatformDefaults,
  };
}

function buildStatuses(
  cfg: ChannelConfig,
  live: WhatsAppLive | null,
  branding: { schoolName: string; senderName: string; senderEmail: string }
): ChannelStatus[] {
  // ── Email ──
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "";
  const emailOk = !!(process.env.RESEND_API_KEY && fromEmail);
  const domain = fromEmail.includes("@") ? fromEmail.split("@")[1] : "";
  const fromName = branding.senderName || branding.schoolName;
  const email: ChannelStatus = {
    key: "email",
    label: "Email",
    state: !emailOk ? "not_connected" : fromName ? "connected" : "attention",
    detail: emailOk
      ? [
          { label: "Sending domain", value: domain },
          { label: "From", value: `${fromName || "(no name)"} <${branding.senderEmail && branding.senderEmail.endsWith(`@${domain}`) ? branding.senderEmail : fromEmail}>` },
        ]
      : [],
    problem: !emailOk
      ? "Email sending isn't set up on this server (Resend)."
      : fromName
        ? null
        : "Add your school name in the School tab so emails say who they're from instead of a bare address.",
  };

  // ── SMS ──
  const sms: ChannelStatus = {
    key: "sms",
    label: "SMS",
    state: cfg.sms ? "connected" : "not_connected",
    detail: cfg.sms ? [{ label: "Sender number", value: cfg.sms.sender }, ...(cfg.sms.source === "platform" ? [{ label: "Source", value: "Kesher default number" }] : [])] : [],
    problem: cfg.smsProblem,
  };

  // ── WhatsApp ──
  let waState: ChannelState = "not_connected";
  let waProblem: string | null = cfg.whatsappProblem;
  const waDetail: ChannelStatus["detail"] = [];
  if (cfg.whatsapp) {
    waState = "connected";
    waProblem = null;
    waDetail.push({ label: "Phone number ID", value: cfg.whatsapp.phoneNumberId });
    if (live) {
      if (live.number) waDetail.unshift({ label: "Number", value: live.number });
      if (live.verifiedName || cfg.whatsapp.displayName) waDetail.push({ label: "Display name", value: live.verifiedName || cfg.whatsapp.displayName || "" });
      if (live.error) {
        waState = "attention";
        waProblem = live.error;
      } else if (live.phoneStatus && live.phoneStatus !== "CONNECTED") {
        waState = "attention";
        waProblem = `Meta reports this number as ${live.phoneStatus.toLowerCase().replace(/_/g, " ")}.`;
      } else if (live.quality === "RED") {
        waState = "attention";
        waProblem = "Meta rates this number's quality as low (red). Slow down sends and check recent complaints.";
      } else if (live.template && live.template.status !== "APPROVED") {
        waState = "attention";
        waProblem =
          live.template.status === "NOT_FOUND"
            ? `Template "${cfg.whatsapp.templateName}" wasn't found in this WhatsApp account.`
            : `Template "${cfg.whatsapp.templateName}" is ${live.template.status.toLowerCase()} — WhatsApp messages won't send until it's approved.`;
      } else if (live.template?.category === "MARKETING") {
        waState = "attention";
        waProblem = "This template is categorized MARKETING, which Meta blocks to US numbers. Use a UTILITY template.";
      } else if (!cfg.whatsapp.wabaId) {
        waState = "attention";
        waProblem = "Add the WhatsApp Business Account (WABA) ID so Kesher can check your template's approval.";
      }
    }
  }
  const whatsapp: ChannelStatus = { key: "whatsapp", label: "WhatsApp", state: waState, detail: waDetail, problem: waProblem };

  return [email, sms, whatsapp];
}
