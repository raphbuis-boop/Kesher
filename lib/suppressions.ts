import type { SupabaseClient } from "@supabase/supabase-js";
import { chunk } from "@/lib/supabase-paging";
import { toE164 } from "@/lib/phone";

/**
 * The one list of "never message this address on this channel": STOP replies,
 * email unsubscribes, spam complaints, hard bounces, and anything staff add.
 * Sending (lib/send/recipients.ts) consults only this table. Every query is
 * filtered by org_id; one school's opt-out never affects another school.
 */

export type SuppressionChannel = "email" | "sms" | "whatsapp";
export type SuppressionReason = "stop" | "unsubscribe" | "complaint" | "bounce" | "manual";

export type Suppression = {
  id: string;
  org_id: string;
  channel: SuppressionChannel;
  address: string;
  person_id: string | null;
  reason: SuppressionReason;
  source: string | null;
  keyword: string | null;
  created_at: string;
  released_at: string | null;
  release_reason: string | null;
  confirmation_sent_at: string | null;
  confirmation_attempts: number;
};

export function normalizeAddress(channel: SuppressionChannel, address: string): string | null {
  if (channel === "email") {
    const e = address.trim().toLowerCase();
    return e.includes("@") ? e : null;
  }
  return toE164(address);
}

export const suppressionKey = (channel: SuppressionChannel, address: string) => `${channel}:${address.toLowerCase()}`;

/** Active suppressions for these addresses, as `channel:address` keys. */
export async function loadSuppressedKeys(supabase: SupabaseClient, orgId: string, items: { channel: SuppressionChannel; address: string }[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (const channel of ["email", "sms", "whatsapp"] as const) {
    const addresses = [...new Set(items.filter((i) => i.channel === channel).map((i) => i.address.toLowerCase()))];
    for (const part of chunk(addresses, 150)) {
      const { data, error } = await supabase.from("suppressions").select("address").eq("org_id", orgId).eq("channel", channel).is("released_at", null).in("address", part);
      if (error) throw new Error(`Opt-out lookup failed: ${error.message}`);
      for (const row of (data ?? []) as { address: string }[]) out.add(suppressionKey(channel, row.address));
    }
  }
  return out;
}

export async function isActiveSuppression(supabase: SupabaseClient, orgId: string, channel: SuppressionChannel, address: string): Promise<boolean> {
  const a = normalizeAddress(channel, address);
  if (!a) return false;
  return (await loadSuppressedKeys(supabase, orgId, [{ channel, address: a }])).has(suppressionKey(channel, a));
}

export type AddSuppressionInput = {
  orgId: string;
  channel: SuppressionChannel;
  address: string;
  personId?: string | null;
  reason: SuppressionReason;
  source: string;
  keyword?: string | null;
  createdBy?: string | null;
};

/** Adds (or finds) the active suppression. `created: false` means it already existed (a repeat STOP). */
export async function addSuppression(supabase: SupabaseClient, input: AddSuppressionInput): Promise<{ created: boolean; id: string | null }> {
  const address = normalizeAddress(input.channel, input.address);
  if (!address) return { created: false, id: null };
  const { data: existing } = await supabase.from("suppressions").select("id, person_id").eq("org_id", input.orgId).eq("channel", input.channel).eq("address", address).is("released_at", null).maybeSingle();
  if (existing) {
    if (!existing.person_id && input.personId) await supabase.from("suppressions").update({ person_id: input.personId }).eq("id", existing.id);
    return { created: false, id: existing.id as string };
  }
  const { data, error } = await supabase
    .from("suppressions")
    .insert({ org_id: input.orgId, channel: input.channel, address, person_id: input.personId ?? null, reason: input.reason, source: input.source, keyword: input.keyword ?? null, created_by: input.createdBy ?? null })
    .select("id")
    .single();
  if (error) {
    // 23505: another request added the same opt-out a moment ago
    if (error.code === "23505") return { created: false, id: null };
    throw new Error(`Couldn't record the opt-out: ${error.message}`);
  }
  return { created: true, id: data.id as string };
}

export async function releaseSuppressions(
  supabase: SupabaseClient,
  orgId: string,
  where: { channel: SuppressionChannel; address: string; onlyReasons?: SuppressionReason[] } | { id: string },
  by: { userId?: string | null; reason: string }
): Promise<number> {
  let q = supabase.from("suppressions").update({ released_at: new Date().toISOString(), released_by: by.userId ?? null, release_reason: by.reason.slice(0, 300) }).eq("org_id", orgId).is("released_at", null);
  if ("id" in where) q = q.eq("id", where.id);
  else {
    const address = normalizeAddress(where.channel, where.address);
    if (!address) return 0;
    q = q.eq("channel", where.channel).eq("address", address);
    if (where.onlyReasons) q = q.in("reason", where.onlyReasons);
  }
  const { data, error } = await q.select("id");
  if (error) throw new Error(`Couldn't release the opt-out: ${error.message}`);
  return data?.length ?? 0;
}

/** Everything on the list for a person's addresses (active and released), newest first. */
export async function listSuppressionsFor(supabase: SupabaseClient, orgId: string, personId: string, addresses: { channel: SuppressionChannel; address: string }[]): Promise<Suppression[]> {
  const cols = "id, org_id, channel, address, person_id, reason, source, keyword, created_at, released_at, release_reason, confirmation_sent_at, confirmation_attempts";
  const byPerson = await supabase.from("suppressions").select(cols).eq("org_id", orgId).eq("person_id", personId);
  const rows = new Map<string, Suppression>(((byPerson.data ?? []) as Suppression[]).map((r) => [r.id, r]));
  for (const channel of ["email", "sms", "whatsapp"] as const) {
    const list = [...new Set(addresses.filter((a) => a.channel === channel).map((a) => normalizeAddress(channel, a.address)).filter((x): x is string => !!x))];
    if (list.length === 0) continue;
    const { data } = await supabase.from("suppressions").select(cols).eq("org_id", orgId).eq("channel", channel).in("address", list);
    for (const r of (data ?? []) as Suppression[]) rows.set(r.id, r);
  }
  return [...rows.values()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
