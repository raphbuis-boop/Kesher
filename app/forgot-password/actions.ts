"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthCallbackUrl } from "@/lib/site-url";

export type RequestResetState = {
  success: boolean;
  error: string | null;
};

/**
 * Kicks off Supabase's password-recovery email. redirectTo MUST be the
 * app's own /auth/callback route (never the bare site root) — Supabase
 * appends its own code/token params to this URL, and /auth/callback is
 * what exchanges those for a session and forwards type=recovery to
 * /reset-password. See lib/site-url.ts for why this must never be hardcoded.
 *
 * Always reports success even if the email doesn't match an account, so
 * this endpoint can't be used to enumerate registered emails.
 */
export async function requestPasswordReset(
  _prevState: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) {
    return { success: false, error: "Enter your email address." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthCallbackUrl(),
  });

  if (error) {
    console.error("[requestPasswordReset]", error.message);
  }

  return { success: true, error: null };
}
