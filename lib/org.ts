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

/**
 * True when this org's SMS/email/WhatsApp sends should be simulated instead
 * of hitting a real provider (settings row: key='simulate_sends',
 * value='true') — see sendMessage() in app/messages/actions.ts. Stored in
 * `settings` (not a schema column) so no migration is needed to flip it.
 *
 * This is deliberately independent of an org having sample/demo data and
 * generic branding — those are just ordinary rows in `people`/`groups`/
 * `settings` like any other org's. A tenant can have fully fake contacts
 * and still send real messages (e.g. a sales-demo account the owner sends
 * real test emails from); this flag only controls whether sendMessage()
 * calls the real provider or fabricates success. Previously named
 * `demo_mode`, which conflated "has sample data" with "blocks real sends"
 * and made the coupling easy to trip over.
 */
export async function sendsAreSimulated(orgId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "simulate_sends")
    .maybeSingle();

  return data?.value === "true";
}
