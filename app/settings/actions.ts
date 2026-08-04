"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { revalidatePath } from "next/cache";

export type SettingsState = {
  success: boolean;
  error: string | null;
};

const FIELDS = [
  "school_name",
  "school_logo_url",
  "primary_color",
  "website_url",
  "footer_text",
  "reply_to_email",
  "sender_name",
  "sender_email",
] as const;

export async function saveSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  const rows = FIELDS.map((key) => ({
    org_id: orgId,
    key,
    value: ((formData.get(key) as string) ?? "").trim(),
  }));

  const { error } = await supabase
    .from("settings")
    .upsert(rows, { onConflict: "org_id,key" });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/messages");
  revalidatePath("/messages/new");
  return { success: true, error: null };
}
