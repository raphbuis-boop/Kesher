"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type UpdatePasswordState = {
  error: string | null;
};

/**
 * Completes the recovery flow: /auth/callback already exchanged Supabase's
 * code for a session (cookies set), so this just needs an authenticated
 * request to call updateUser({ password }). Works for any authenticated
 * session, not only recovery ones — harmless, since it can only ever change
 * the caller's own password.
 */
export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = (formData.get("password") as string | null) ?? "";
  const confirmPassword = (formData.get("confirm_password") as string | null) ?? "";

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createSupabaseServerClient();

  // No session (expired/invalid/already-used recovery link) — surface clearly
  // instead of letting updateUser fail with a generic auth error.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
