import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateString } from "@/lib/schoolTime";

/**
 * Hebrew dates shown next to the regular date. Computed with the platform's
 * Hebrew calendar (Intl), so it works offline and never goes stale. The Hebrew
 * day really begins at sunset; this uses the civil date, which is what a school
 * wants next to a "sent on" or "scheduled for" date.
 */

export type HebrewDateStyle = "off" | "latin" | "hebrew";

// ICU spells the months its own way; schools expect the usual transliteration
const MONTHS: Record<string, string> = { Tishri: "Tishrei", Heshvan: "Cheshvan", Shevat: "Sh'vat", Tamuz: "Tammuz" };

export function hebrewDateString(at: Date | string, tz: string, style: Exclude<HebrewDateStyle, "off"> = "latin"): string {
  const date = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(date.getTime())) return "";
  // Noon UTC on the school's local calendar day, so time zones can't shift the day
  const noon = new Date(`${localDateString(date, tz)}T12:00:00Z`);
  try {
    if (style === "hebrew") return new Intl.DateTimeFormat("he-u-ca-hebrew", { dateStyle: "long", timeZone: "UTC" }).format(noon);
    return new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .formatToParts(noon)
      .map((p) => (p.type === "month" ? (MONTHS[p.value] ?? p.value) : p.value))
      .join("");
  } catch {
    return "";
  }
}

export function isHebrewDateStyle(v: unknown): v is HebrewDateStyle {
  return v === "off" || v === "latin" || v === "hebrew";
}

/** Settings key hebrew_dates; on (English letters) unless a school changes it. */
export async function getHebrewDateStyle(supabase: SupabaseClient, orgId: string): Promise<HebrewDateStyle> {
  const { data } = await supabase.from("settings").select("value").eq("org_id", orgId).eq("key", "hebrew_dates").maybeSingle();
  return isHebrewDateStyle(data?.value) ? data.value : "latin";
}
