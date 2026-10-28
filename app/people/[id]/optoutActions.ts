"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { addSuppression, normalizeAddress, releaseSuppressions, type SuppressionChannel } from "@/lib/suppressions";

export type OptOutResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Staff can put an address back on the list only with a typed reason, which is
 * stored with who did it and when. (A parent can restore a STOP themselves by
 * replying START; unsubscribes, complaints and bounces need the school.)
 */
export async function restoreOptOut(personId: string, suppressionId: string, reason: string): Promise<OptOutResult> {
  try {
    const { orgId, userId } = await requireRole(ADMIN_ROLES);
    const why = reason.trim();
    if (why.length < 5) return { ok: false, error: "Type a reason, for example: parent called and asked to be added back." };
    const supabase = await createSupabaseServerClient();
    const n = await releaseSuppressions(supabase, orgId, { id: suppressionId }, { userId, reason: why });
    revalidatePath(`/people/${personId}`);
    return n > 0 ? { ok: true, message: "Messages to this address are allowed again." } : { ok: false, error: "That opt-out was already lifted." };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function stopMessaging(personId: string, channel: SuppressionChannel): Promise<OptOutResult> {
  try {
    const { orgId, userId } = await requireRole(ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const { data: person } = await supabase.from("people").select("email, phone, whatsapp").eq("org_id", orgId).eq("id", personId).maybeSingle();
    if (!person) return { ok: false, error: "Contact not found." };
    const raw = channel === "email" ? person.email : channel === "sms" ? person.phone : (person.whatsapp || person.phone);
    const address = raw ? normalizeAddress(channel, raw as string) : null;
    if (!address) return { ok: false, error: "There's no valid address on file for that channel." };
    await addSuppression(supabase, { orgId, channel, address, personId, reason: "manual", source: "staff", createdBy: userId });
    revalidatePath(`/people/${personId}`);
    return { ok: true, message: "They won't receive messages on that channel." };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}
