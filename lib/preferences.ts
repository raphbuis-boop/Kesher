import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kesher-only contact data (contact_preferences). Lives in its own table so a
 * sync from FACTS / a Google Sheet can never overwrite what a parent or the
 * school chose here.
 */
export type ContactPreferences = {
  whatsapp_opt_in: boolean | null;
  language: string | null;
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  preferred_channel: "whatsapp" | "sms" | "email" | null;
  emergency_only: boolean;
  muted_group_ids: string[];
  sms_consent_at: string | null;
  sms_consent_text: string | null;
  consent_source: string | null;
};

export const DEFAULT_PREFERENCES: ContactPreferences = {
  whatsapp_opt_in: null,
  language: null,
  email_enabled: true,
  sms_enabled: true,
  whatsapp_enabled: true,
  preferred_channel: null,
  emergency_only: false,
  muted_group_ids: [],
  sms_consent_at: null,
  sms_consent_text: null,
  consent_source: null,
};

export const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "he", label: "Hebrew" },
  { value: "yi", label: "Yiddish" },
  { value: "ru", label: "Russian" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

const PREF_COLUMNS =
  "person_id, whatsapp_opt_in, language, email_enabled, sms_enabled, whatsapp_enabled, preferred_channel, emergency_only, muted_group_ids, sms_consent_at, sms_consent_text, consent_source";

export async function getPreferences(
  supabase: SupabaseClient,
  orgId: string,
  personId: string
): Promise<ContactPreferences> {
  const { data } = await supabase
    .from("contact_preferences")
    .select(PREF_COLUMNS)
    .eq("org_id", orgId)
    .eq("person_id", personId)
    .maybeSingle();
  return data ? { ...DEFAULT_PREFERENCES, ...(data as Partial<ContactPreferences>) } : DEFAULT_PREFERENCES;
}

/** Preferences for many people at once (missing rows = defaults). Chunked to keep URLs short. */
export async function getPreferencesMap(
  supabase: SupabaseClient,
  orgId: string,
  personIds: string[]
): Promise<Map<string, ContactPreferences>> {
  const map = new Map<string, ContactPreferences>();
  for (let i = 0; i < personIds.length; i += 200) {
    const { data, error } = await supabase
      .from("contact_preferences")
      .select(PREF_COLUMNS)
      .eq("org_id", orgId)
      .in("person_id", personIds.slice(i, i + 200));
    if (error) throw new Error(`getPreferencesMap: ${error.message}`);
    for (const row of (data ?? []) as (Partial<ContactPreferences> & { person_id: string })[]) {
      map.set(row.person_id, { ...DEFAULT_PREFERENCES, ...row });
    }
  }
  return map;
}
