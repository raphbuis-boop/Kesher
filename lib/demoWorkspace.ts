import type { SupabaseClient } from "@supabase/supabase-js";
import { seedRiverside, clearOrgData } from "@/scripts/riverside-seed-data";

/**
 * User-facing "Load demo workspace" / "Remove demo data" feature.
 *
 * Reuses the same fictional Riverside Academy dataset generator that backs
 * scripts/setup_riverside_demo.ts (guaranteed-fake @example.com emails and
 * NANP reserved-for-fiction 555-01XX phone numbers — never a real person,
 * never a real send). The difference here is that this seeds directly into
 * the CURRENT signed-in user's own org (never creates or switches orgs, never
 * touches another tenant), only ever runs when that org's `people` table is
 * empty, and — unlike the internal admin scripts — never overwrites a real
 * school name / sender identity the user already configured: branding
 * settings are only written if currently blank, and `simulate_sends` is left
 * alone entirely (this flow never calls a delivery provider itself, so there
 * is nothing to simulate).
 *
 * Every caller MUST pass a request-scoped Supabase client created via
 * lib/supabase-server.ts's createSupabaseServerClient() (never the
 * service-role admin client) so every read/write is still subject to the
 * org-scoped RLS policies in scripts/migrate_multitenancy.sql — this module
 * adds explicit .eq("org_id", orgId) filters as defence-in-depth on top of
 * that, exactly like the rest of the app's server actions.
 */

export const DEMO_MANIFEST_KEY = "demo_seed_manifest";

export type DemoManifest = {
  version: 1;
  seededAt: string;
  personIds: string[];
  groupIds: string[];
  tagIds: string[];
  messageIds: string[];
  settingsKeysSet: string[];
};

function isDemoManifest(value: unknown): value is DemoManifest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.personIds) &&
    Array.isArray(v.groupIds) &&
    Array.isArray(v.tagIds) &&
    Array.isArray(v.messageIds) &&
    Array.isArray(v.settingsKeysSet)
  );
}

/** True when this org has zero contacts — the only state "Load demo workspace" is offered in. */
export async function isWorkspaceEmpty(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) throw new Error(`isWorkspaceEmpty failed: ${error.message}`);
  return (count ?? 0) === 0;
}

/** Reads the manifest of demo-seeded row IDs for this org, if any. */
export async function getDemoManifest(supabase: SupabaseClient, orgId: string): Promise<DemoManifest | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", DEMO_MANIFEST_KEY)
    .maybeSingle();
  if (error) throw new Error(`getDemoManifest failed: ${error.message}`);
  if (!data?.value) return null;
  try {
    const parsed = JSON.parse(data.value);
    return isDemoManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Convenience for pages that only need to know "should I show the sample-data label?" */
export async function isDemoWorkspaceLoaded(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  return (await getDemoManifest(supabase, orgId)) !== null;
}

// One additional "in flight" campaign, on top of Riverside's historical sent
// messages — reads as a live/just-composed send (real amber "sending" status,
// same as a genuine in-progress campaign; the app has no persisted draft
// concept yet, see app/messages/page.tsx's "Drafts — Coming soon" tab, so this
// is the closest authentic stand-in for "a campaign draft").
async function seedInFlightCampaign(supabase: SupabaseClient, orgId: string): Promise<string> {
  const { count: parentCount } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .contains("categories", ["parent"]);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      org_id: orgId,
      subject: "Fall Festival — Save the Date",
      body: "Save the date for our Fall Festival! More details to follow soon — food trucks, games, and a chance to connect with other Riverside families.",
      channel: "email",
      audience_slug: "all-parents",
      audience_label: "All Parents",
      recipient_count: parentCount ?? 0,
      status: "sending",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedInFlightCampaign failed: ${error?.message}`);
  return data.id as string;
}

async function snapshotOrgRowIds(supabase: SupabaseClient, orgId: string) {
  const [people, groups, tags, messages] = await Promise.all([
    supabase.from("people").select("id").eq("org_id", orgId),
    supabase.from("groups").select("id").eq("org_id", orgId),
    supabase.from("tags").select("id").eq("org_id", orgId),
    supabase.from("messages").select("id").eq("org_id", orgId),
  ]);
  for (const r of [people, groups, tags, messages]) {
    if (r.error) throw new Error(`snapshotOrgRowIds failed: ${r.error.message}`);
  }
  return {
    personIds: (people.data ?? []).map((r) => r.id as string),
    groupIds: (groups.data ?? []).map((r) => r.id as string),
    tagIds: (tags.data ?? []).map((r) => r.id as string),
    messageIds: (messages.data ?? []).map((r) => r.id as string),
  };
}

export type LoadDemoResult = {
  peopleCount: number;
  groupCount: number;
  messageCount: number;
};

/**
 * Seeds the fictional Riverside Academy dataset into `orgId`. Refuses if the
 * workspace isn't empty (belt-and-suspenders — callers must already gate the
 * "Load demo workspace" action on isWorkspaceEmpty(), same check repeated
 * here so a stale UI or a duplicate click can't ever double-seed).
 */
export async function loadDemoWorkspace(supabase: SupabaseClient, orgId: string): Promise<LoadDemoResult> {
  if (!(await isWorkspaceEmpty(supabase, orgId))) {
    throw new Error("This workspace already has data — demo data can only be loaded into an empty workspace.");
  }

  // Seeding is several sequential inserts, not one transaction. If any step
  // fails partway (e.g. a constraint violation), roll back everything this
  // call inserted so the workspace is left genuinely empty again — never a
  // half-seeded org with no manifest, which would strand it (neither "Load"
  // nor "Remove" would be offered, since it's neither empty nor tracked).
  let result: Awaited<ReturnType<typeof seedRiverside>>;
  try {
    result = await seedRiverside(supabase, orgId, {
      settingsOnlyIfBlank: true, // never clobber a real school name / sender identity
      setSimulateSends: false, // this flow never calls a delivery provider; nothing to simulate
    });
    await seedInFlightCampaign(supabase, orgId);
  } catch (err) {
    await clearOrgData(supabase, orgId).catch((cleanupErr) => {
      console.error("[loadDemoWorkspace] rollback after failed seed also failed:", cleanupErr);
    });
    throw err;
  }

  const snapshot = await snapshotOrgRowIds(supabase, orgId);

  const manifest: DemoManifest = {
    version: 1,
    seededAt: new Date().toISOString(),
    ...snapshot,
    settingsKeysSet: result.settingsKeysSet,
  };

  const { error: manifestError } = await supabase
    .from("settings")
    .upsert({ org_id: orgId, key: DEMO_MANIFEST_KEY, value: JSON.stringify(manifest) }, { onConflict: "org_id,key" });
  if (manifestError) {
    // Manifest write failed but data is real and fully seeded — don't roll
    // back a successful seed over a settings-write hiccup; surface it so the
    // caller can retry writing the manifest instead of losing the data.
    throw new Error(`loadDemoWorkspace: failed to write manifest: ${manifestError.message}`);
  }

  return {
    peopleCount: snapshot.personIds.length,
    groupCount: snapshot.groupIds.length,
    messageCount: snapshot.messageIds.length,
  };
}

export type RemoveDemoResult = {
  peopleRemoved: number;
  groupsRemoved: number;
  messagesRemoved: number;
};

/**
 * Deletes exactly the rows recorded in this org's demo manifest — never a
 * broader "clear the whole org" wipe — then reverts any branding settings
 * this seed set (only ones that were blank beforehand) and removes the
 * manifest itself. No-ops safely (returns zero counts) if no manifest exists,
 * so clicking "Remove demo data" twice is harmless.
 */
export async function removeDemoWorkspace(supabase: SupabaseClient, orgId: string): Promise<RemoveDemoResult> {
  const manifest = await getDemoManifest(supabase, orgId);
  if (!manifest) {
    return { peopleRemoved: 0, groupsRemoved: 0, messagesRemoved: 0 };
  }

  // Delete order mirrors clearOrgData in scripts/riverside-seed-data.ts:
  // messages first (cascades message_recipients), then people (cascades
  // person_tags + relationships), then groups (cascades group_tags), then tags.
  if (manifest.messageIds.length > 0) {
    const { error } = await supabase.from("messages").delete().eq("org_id", orgId).in("id", manifest.messageIds);
    if (error) throw new Error(`removeDemoWorkspace: messages delete failed: ${error.message}`);
  }
  if (manifest.personIds.length > 0) {
    const { error } = await supabase.from("people").delete().eq("org_id", orgId).in("id", manifest.personIds);
    if (error) throw new Error(`removeDemoWorkspace: people delete failed: ${error.message}`);
  }
  if (manifest.groupIds.length > 0) {
    const { error } = await supabase.from("groups").delete().eq("org_id", orgId).in("id", manifest.groupIds);
    if (error) throw new Error(`removeDemoWorkspace: groups delete failed: ${error.message}`);
  }
  if (manifest.tagIds.length > 0) {
    const { error } = await supabase.from("tags").delete().eq("org_id", orgId).in("id", manifest.tagIds);
    if (error) throw new Error(`removeDemoWorkspace: tags delete failed: ${error.message}`);
  }

  // Revert only the branding keys this seed actually set (i.e. were blank before).
  for (const key of manifest.settingsKeysSet) {
    const { error } = await supabase.from("settings").delete().eq("org_id", orgId).eq("key", key);
    if (error) throw new Error(`removeDemoWorkspace: settings revert failed for ${key}: ${error.message}`);
  }

  const { error: manifestError } = await supabase
    .from("settings")
    .delete()
    .eq("org_id", orgId)
    .eq("key", DEMO_MANIFEST_KEY);
  if (manifestError) throw new Error(`removeDemoWorkspace: failed to clear manifest: ${manifestError.message}`);

  return {
    peopleRemoved: manifest.personIds.length,
    groupsRemoved: manifest.groupIds.length,
    messagesRemoved: manifest.messageIds.length,
  };
}
