import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Is it OK to send right now? (Shabbos / Yom Tov blocking is added in Phase 3.1;
 * this is the single place every manual and scheduled send asks.)
 */
export type SendWindowStatus = { blocked: false } | { blocked: true; message: string; until: string | null };

export async function sendWindowStatus(supabase: SupabaseClient, orgId: string, at: Date = new Date()): Promise<SendWindowStatus> {
  void supabase;
  void orgId;
  void at;
  return { blocked: false };
}
