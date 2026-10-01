"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { hashInviteToken } from "@/lib/invites";

export type AcceptResult = { ok: true } | { ok: false; error: string };

/**
 * Accepts an invite for the signed-in user. All checks (single use, expiry,
 * revocation, email match, confirmed email) happen atomically inside the
 * accept_invite() database function; this only hashes the token.
 */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  if (!token || token.length > 200) return { ok: false, error: "This invite link is not valid." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("accept_invite", { p_token_hash: hashInviteToken(token) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Signs out, then sends the person to sign in with the invited email. */
export async function switchAccountForInvite(token: string, email: string) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const params = new URLSearchParams({ next: `/invite/${token}`, email });
  redirect(`/login?${params.toString()}`);
}

/** For a signed-in user who belongs to no school: create their own workspace. */
export async function createPersonalWorkspace(): Promise<AcceptResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_personal_org");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
