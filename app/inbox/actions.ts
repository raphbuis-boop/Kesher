"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership } from "@/lib/org";
import { sendThreadMessage, type InboxChannel, type ReplyResult } from "@/lib/inbox";

/** Staff replies, assignment and "done" for the inbox. Every query is scoped to the caller's school. */

export async function replyToThread(threadId: string, body: string, channel: InboxChannel, asTemplate = false): Promise<ReplyResult> {
  const { orgId, userId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  const res = await sendThreadMessage(supabase, { orgId, userId }, { threadId, body, channel: channel === "whatsapp" ? "whatsapp" : "sms", asTemplate });
  revalidatePath("/inbox");
  return res;
}

export type InboxActionResult = { ok: true } | { ok: false; error: string };

export async function markThreadRead(threadId: string): Promise<void> {
  const { orgId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  await supabase.from("message_threads").update({ unread_count: 0 }).eq("org_id", orgId).eq("id", threadId).gt("unread_count", 0);
  revalidatePath("/inbox");
}

export async function setThreadDone(threadId: string, done: boolean): Promise<InboxActionResult> {
  const { orgId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("message_threads")
    .update({ status: done ? "done" : "open", ...(done ? { unread_count: 0 } : {}) })
    .eq("org_id", orgId)
    .eq("id", threadId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That conversation no longer exists." };
  revalidatePath("/inbox");
  return { ok: true };
}

/** Assign to a teammate (or nobody). The assignee must belong to this school. */
export async function assignThread(threadId: string, userId: string | null): Promise<InboxActionResult> {
  const { orgId } = await getMembership();
  const supabase = await createSupabaseServerClient();
  if (userId) {
    const { data: member } = await supabase.from("memberships").select("user_id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
    if (!member) return { ok: false, error: "That person isn't on your team." };
  }
  const { data, error } = await supabase.from("message_threads").update({ assigned_to: userId }).eq("org_id", orgId).eq("id", threadId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That conversation no longer exists." };
  revalidatePath("/inbox");
  return { ok: true };
}
