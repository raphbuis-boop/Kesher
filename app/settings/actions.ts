"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
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
] as const;

export async function saveSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createSupabaseServerClient();

  const rows = FIELDS.map((key) => ({
    key,
    value: ((formData.get(key) as string) ?? "").trim(),
  }));

  const { error } = await supabase
    .from("settings")
    .upsert(rows, { onConflict: "key" });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  return { success: true, error: null };
}
