"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { getSignupSettings } from "@/lib/signup";

export type SignupSettingsResult = { ok: true; message?: string } | { ok: false; error: string };

export async function saveSignupSettings(input: { enabled: boolean; intro: string }): Promise<SignupSettingsResult> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("settings").upsert(
      [
        { org_id: orgId, key: "signup_enabled", value: input.enabled ? "true" : "false" },
        { org_id: orgId, key: "signup_intro", value: input.intro.trim().slice(0, 1000) },
      ],
      { onConflict: "org_id,key" }
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Replaces the signup link and QR code; every older printed link stops working. */
export async function resetSignupLink(): Promise<SignupSettingsResult> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const current = await getSignupSettings(supabase, orgId);
    const { error } = await supabase.from("settings").upsert({ org_id: orgId, key: "signup_epoch", value: String(current.epoch + 1) }, { onConflict: "org_id,key" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings");
    return { ok: true, message: "New link created. The old link and QR code no longer work." };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}
