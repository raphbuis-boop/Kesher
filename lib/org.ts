import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type Role = "owner" | "admin" | "member";

export type Membership = {
  userId: string;
  orgId: string;
  role: Role;
};

/** Roles allowed to change settings, manage the team and see Data. */
export const ADMIN_ROLES: Role[] = ["owner", "admin"];

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

/**
 * The signed-in user's active membership: their org and role.
 *
 * One active org per user: if someone belongs to several (e.g. they had their
 * own workspace and then accepted an invite), the most recent membership
 * wins. There is no org switcher.
 *
 * Identity comes from getClaims(), which verifies the session JWT's
 * signature (locally against the project's cached JWKS when asymmetric
 * signing keys are enabled; via the Auth server for legacy HS256 projects).
 * Wrapped in React cache() so a page, its layout and helpers share one
 * lookup per request.
 *
 * - Not authenticated → throws.
 * - Authenticated but no membership (removed from their team, or an invite
 *   that was never accepted) → redirects to /no-workspace. Because this runs
 *   on every request and RLS keys on the same table, removing a member blocks
 *   their access immediately.
 */
export const getMembership = cache(async (): Promise<Membership> => {
  const supabase = await createSupabaseServerClient();

  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (authError || !userId) {
    throw new Error("Not authenticated — cannot resolve org.");
  }

  // Filter on user_id explicitly: RLS also exposes teammates' rows.
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Could not load your school membership: ${membershipError.message}`);
  }
  if (!membership) {
    redirect("/no-workspace");
  }

  return { userId, orgId: membership.org_id as string, role: membership.role as Role };
});

/**
 * Returns the org_id for the currently authenticated user.
 *
 * Used by every server action and page that reads or writes tenant-scoped
 * data. The org_id is the security boundary — it must be stamped on every
 * INSERT and used in every SELECT for defence-in-depth (RLS is the hard
 * wall; explicit org_id in queries is the belt-and-suspenders layer).
 */
export const getOrgId = cache(async (): Promise<string> => (await getMembership()).orgId);

export class PermissionError extends Error {
  constructor(message = "You don't have permission to do that. Ask your school's owner or an admin.") {
    super(message);
    this.name = "PermissionError";
  }
}

/** Server-side role gate for server actions and route handlers. */
export async function requireRole(allowed: Role[]): Promise<Membership> {
  const m = await getMembership();
  if (!allowed.includes(m.role)) throw new PermissionError();
  return m;
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
