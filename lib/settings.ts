import { createSupabaseServerClient } from "@/lib/supabase-server";

export type BrandingSettings = {
  schoolName: string;
  logoUrl: string;
  primaryColor: string;
  websiteUrl: string;
  footerText: string;
  replyToEmail: string;
  senderName: string;
  senderEmail: string;
};

/** Env-var fallbacks used when the settings table has no value set. */
const ENV_DEFAULTS: BrandingSettings = {
  schoolName: "",
  logoUrl: "",
  primaryColor: "#1e3a6e",
  websiteUrl: "",
  footerText: "",
  replyToEmail: "",
  senderName: "",
  senderEmail: process.env.RESEND_FROM_EMAIL ?? "",
};

const KEY_MAP: Record<string, keyof BrandingSettings> = {
  school_name: "schoolName",
  school_logo_url: "logoUrl",
  primary_color: "primaryColor",
  website_url: "websiteUrl",
  footer_text: "footerText",
  reply_to_email: "replyToEmail",
  sender_name: "senderName",
  sender_email: "senderEmail",
};

/**
 * Fetch branding settings from Supabase, falling back to environment variables
 * if the settings table doesn't exist yet or a field is blank.
 */
export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("settings").select("key, value");
    if (error || !data) return ENV_DEFAULTS;

    const result = { ...ENV_DEFAULTS };
    for (const row of data as { key: string; value: string }[]) {
      const field = KEY_MAP[row.key];
      if (field && row.value?.trim()) {
        (result as Record<string, string>)[field] = row.value.trim();
      }
    }
    return result;
  } catch {
    return ENV_DEFAULTS;
  }
}
