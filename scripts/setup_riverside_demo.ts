/**
 * One-time setup: turns the EXISTING auth user contact@kesherhq.co into the
 * Riverside Academy demo tenant.
 *
 * What it does (and nothing else):
 *   1. Finds the contact@kesherhq.co auth user (does NOT create a new user).
 *   2. Reads its current membership row. If it already points to an org named
 *      "Riverside Academy", reuses that org (safe to re-run). Otherwise
 *      creates a brand-new "Riverside Academy" org and MOVES (updates) that
 *      one membership row to point to it — no other user's membership is
 *      touched, and no person/message/group/tag/relationship row is touched.
 *   3. Seeds the new org with a generic private-school demo dataset
 *      (scripts/riverside-seed-data.ts).
 *
 * Never touches the "Legacy Organization" or any other org's data.
 *
 * Run: npx tsx scripts/setup_riverside_demo.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { seedRiverside } from "./riverside-seed-data";

const DEMO_EMAIL = "contact@kesherhq.co";
const DEMO_ORG_NAME = "Riverside Academy";

function loadEnvFile(fname: string) {
  const envPath = path.join(process.cwd(), fname);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.vercel");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  // ── 1. Find the existing auth user (never create one) ──────────────────────
  const { data: userList, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (userErr) throw new Error(`listUsers failed: ${userErr.message}`);
  const user = userList.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
  if (!user) throw new Error(`No auth user found for ${DEMO_EMAIL}. Refusing to create one.`);
  console.log(`[setup] found user ${DEMO_EMAIL} (id=${user.id})`);

  // ── 2. Read current membership ──────────────────────────────────────────────
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (memErr || !membership) throw new Error(`No membership found for ${DEMO_EMAIL}: ${memErr?.message}`);

  const { data: currentOrg, error: currentOrgErr } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("id", membership.org_id)
    .single();
  if (currentOrgErr || !currentOrg) throw new Error(`Could not load current org: ${currentOrgErr?.message}`);

  console.log(`[setup] ${DEMO_EMAIL} currently belongs to org "${currentOrg.name}" (${currentOrg.id})`);

  let riversideOrgId: string;

  if (currentOrg.name === DEMO_ORG_NAME) {
    // Already split off on a prior run — reuse it.
    riversideOrgId = currentOrg.id;
    console.log(`[setup] already on a "${DEMO_ORG_NAME}" org — reusing it, will reseed.`);
  } else {
    // Safety check: never repoint a membership away from an org this user shares
    // with other users unless we're sure — just log it clearly.
    const { count: coMemberCount } = await supabase
      .from("memberships")
      .select("*", { count: "exact", head: true })
      .eq("org_id", currentOrg.id);
    console.log(`[setup] current org "${currentOrg.name}" has ${coMemberCount} member(s) total.`);

    const { data: newOrg, error: newOrgErr } = await supabase
      .from("orgs")
      .insert({ name: DEMO_ORG_NAME })
      .select("id")
      .single();
    if (newOrgErr || !newOrg) throw new Error(`Failed to create org: ${newOrgErr?.message}`);
    riversideOrgId = newOrg.id;
    console.log(`[setup] created new org "${DEMO_ORG_NAME}" (${riversideOrgId})`);

    const { error: updateErr } = await supabase
      .from("memberships")
      .update({ org_id: riversideOrgId })
      .eq("user_id", user.id)
      .eq("org_id", currentOrg.id);
    if (updateErr) throw new Error(`Failed to move membership: ${updateErr.message}`);
    console.log(`[setup] moved ${DEMO_EMAIL}'s membership to "${DEMO_ORG_NAME}". Original org "${currentOrg.name}" (${currentOrg.id}) was NOT modified.`);
  }

  // ── 3. Seed the dataset ──────────────────────────────────────────────────────
  const result = await seedRiverside(supabase, riversideOrgId);

  console.log("\n── Done ──");
  console.log(`Riverside Academy org_id: ${riversideOrgId}`);
  console.log(`Families: ${result.familyCount}  People: ${result.peopleCount}  Relationships: ${result.relationshipCount}  Messages: ${result.messageCount}`);
  console.log(`Log in as ${DEMO_EMAIL} with its existing password to view it.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
