import type { SupabaseClient } from "@supabase/supabase-js";
import { HEARTBEAT } from "./dispatch";

export const DISPATCHER_STALE_MS = 15 * 60_000;

export type DispatcherHealth = { healthy: boolean; lastRunAt: string | null };

/** Has the background sender (scheduled + repeating sends) checked in recently? */
export async function getDispatcherHealth(supabase: SupabaseClient): Promise<DispatcherHealth> {
  const { data } = await supabase.from("system_heartbeats").select("last_run_at").eq("name", HEARTBEAT).maybeSingle();
  const last = (data?.last_run_at as string | undefined) ?? null;
  return { healthy: !!last && Date.now() - new Date(last).getTime() < DISPATCHER_STALE_MS, lastRunAt: last };
}
