"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { isValidTimezone } from "@/lib/schoolTime";

export type MessagingResult = { ok: true; message?: string } | { ok: false; error: string };

export async function saveMessagingSettings(input: { timezone: string; requireApproval: boolean }): Promise<MessagingResult> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    if (!isValidTimezone(input.timezone)) return { ok: false, error: "That isn't a time zone Kesher recognizes." };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("settings").upsert(
      [
        { org_id: orgId, key: "timezone", value: input.timezone },
        { org_id: orgId, key: "require_approval", value: input.requireApproval ? "true" : "false" },
      ],
      { onConflict: "org_id,key" }
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings");
    revalidatePath("/messages");
    return { ok: true };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}
