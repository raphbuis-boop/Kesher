import type { SupabaseClient } from "@supabase/supabase-js";
import { windowStatusFor, type WindowStatus } from "@/lib/shabbos";

/**
 * Is it OK to send at this moment? The single place every manual and scheduled
 * send asks. Blocked inside a school's Shabbos / Yom Tov window (when the school
 * has turned that on in Settings → Shabbos & Yom Tov).
 */
export type SendWindowStatus = WindowStatus;

export async function sendWindowStatus(supabase: SupabaseClient, orgId: string, at: Date = new Date()): Promise<SendWindowStatus> {
  return windowStatusFor(supabase, orgId, at);
}
