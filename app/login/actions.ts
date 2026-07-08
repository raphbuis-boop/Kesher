"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next  = (formData.get("next") as string | null) || "/dashboard";

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }

  // Redirect to the originally requested page, or the dashboard.
  // Guard against open-redirect: only allow relative paths starting with /
  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(destination);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
