import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Returns the org_id for the currently authenticated user.
 *
 * Used by every server action and page that reads or writes tenant-scoped
 * data. The org_id is the security boundary — it must be stamped on every
 * INSERT and used in every SELECT for defence-in-depth (RLS is the hard
 * wall; explicit org_id in queries is the belt-and-suspenders layer).
 *
 * Throws if:
 *   - The user is not authenticated
 *   - The user has no membership row (shouldn't happen after the migration
 *     trigger is installed, but surfaced clearly if it does)
 */
export async function getOrgId(): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Not authenticated — cannot resolve org.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    throw new Error(
      `No org membership found for user ${user.id}. ` +
        "Run the multi-tenancy migration and ensure the signup trigger is installed."
    );
  }

  return membership.org_id as string;
}
