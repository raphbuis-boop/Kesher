"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { chunk } from "@/lib/supabase-paging";

export type ReviewResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Approve or reject people waiting in "Review new contacts". Approved people
 * become active (they get messages from now on). Rejected people stay hidden
 * and a later sync won't bring them back.
 */
export async function reviewContacts(personIds: string[], decision: "approve" | "reject"): Promise<ReviewResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireRole(ADMIN_ROLES));
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
  if (personIds.length === 0) return { ok: false, error: "Nothing selected." };
  if (decision !== "approve" && decision !== "reject") return { ok: false, error: "Unknown decision." };

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  let changed = 0;
  for (const ids of chunk(personIds, 200)) {
    const { data, error } = await supabase
      .from("people")
      .update(decision === "approve" ? { status: "active", updated_at: now } : { status: "rejected", updated_at: now })
      .eq("org_id", orgId)
      .eq("status", "pending")
      .in("id", ids)
      .select("id");
    if (error) return { ok: false, error: error.message };
    changed += data?.length ?? 0;
  }

  revalidatePath("/people");
  revalidatePath("/people/review");
  revalidatePath("/audiences");
  revalidatePath("/dashboard");
  const noun = changed === 1 ? "contact" : "contacts";
  return { ok: true, message: decision === "approve" ? `Approved ${changed} ${noun}` : `Rejected ${changed} ${noun}` };
}

/** Undo a rejection: the person goes back to the queue. */
export async function restoreRejected(personId: string): Promise<ReviewResult> {
  let orgId: string;
  try {
    ({ orgId } = await requireRole(ADMIN_ROLES));
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("people")
    .update({ status: "pending" })
    .eq("org_id", orgId)
    .eq("status", "rejected")
    .eq("id", personId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/people/review");
  return { ok: true, message: "Moved back to review" };
}
