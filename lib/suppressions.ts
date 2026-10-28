import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSuppressed } from "@/lib/send/recipients";

export type SuppressionChannel = "email" | "sms" | "whatsapp";

/** Has this address hard-stopped (STOP / unsubscribe) messages from this school? */
export async function isActiveSuppression(supabase: SupabaseClient, orgId: string, channel: SuppressionChannel, address: string): Promise<boolean> {
  void channel;
  return (await loadSuppressed(supabase, orgId, [address])).has(address.toLowerCase());
}
