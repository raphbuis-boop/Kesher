"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signIn(
  formData: FormData
): Promise<{ error: string } | void> {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;
  const next     = (formData.get("next") as string | null) || "/dashboard";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Return to client for inline display — no redirect, no URL pollution.
    return { error: error.message };
  }

  // Guard against open-redirect
  const destination =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(destination);
}

export async function signUp(
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Must be registered in Supabase Dashboard → Auth → URL Configuration.
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kesherhq.co"
      }/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return {
    success:
      "Check your inbox — we sent you a confirmation link to activate your account.",
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
