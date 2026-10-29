import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrandingSettings } from "@/lib/settings";
import type { EmailBranding } from "@/lib/email/render";

/**
 * Email templates: the look of a message (logo/header, colors, sender name,
 * default subject, footer). A template field left blank inherits
 * Settings → School, so a "Basketball" template can change just the header
 * color and sender name.
 */
export type MessageTemplate = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  background_color: string | null;
  sender_name: string | null;
  default_subject: string | null;
  footer_text: string | null;
};

export const TEMPLATE_COLUMNS = "id, name, logo_url, primary_color, background_color, sender_name, default_subject, footer_text";

export async function listTemplates(supabase: SupabaseClient, orgId: string): Promise<MessageTemplate[]> {
  const { data } = await supabase.from("message_templates").select(TEMPLATE_COLUMNS).eq("org_id", orgId).order("name");
  return (data ?? []) as MessageTemplate[];
}

export async function getTemplate(supabase: SupabaseClient, orgId: string, id: string | null | undefined): Promise<MessageTemplate | null> {
  if (!id) return null;
  const { data } = await supabase.from("message_templates").select(TEMPLATE_COLUMNS).eq("org_id", orgId).eq("id", id).maybeSingle();
  return (data as MessageTemplate | null) ?? null;
}

/** audience slug → default template id (system slugs like "parents", or a custom audience's id). */
export async function getAudienceTemplateMap(supabase: SupabaseClient, orgId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from("audience_templates").select("audience_slug, template_id").eq("org_id", orgId);
  return Object.fromEntries(((data ?? []) as { audience_slug: string; template_id: string }[]).map((r) => [r.audience_slug, r.template_id]));
}

/** School branding with a template's non-blank fields laid over it. */
export function applyTemplate(branding: BrandingSettings, t: MessageTemplate | null): EmailBranding {
  return {
    ...branding,
    logoUrl: t?.logo_url?.trim() || branding.logoUrl,
    primaryColor: t?.primary_color?.trim() || branding.primaryColor,
    footerText: t?.footer_text?.trim() || branding.footerText,
    senderName: t?.sender_name?.trim() || branding.senderName,
    backgroundColor: t?.background_color?.trim() || "#eef0f3",
  };
}
