/**
 * Wipes and reseeds the Riverside Academy demo org's data only.
 *
 * Safety: this script REFUSES to run unless contact@kesherhq.co's current
 * membership points to an org literally named "Riverside Academy" — it will
 * never wipe the Legacy Organization or any other tenant.
 *
 * Run: npx tsx scripts/reset_riverside_demo.ts
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
  const { data: userList, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (userErr) throw new Error(`listUsers failed: ${userErr.message}`);
  const user = userList.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
  if (!user) throw new Error(`No auth user found for ${DEMO_EMAIL}.`);

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (memErr || !membership) throw new Error(`No membership found for ${DEMO_EMAIL}: ${memErr?.message}`);

  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("id", membership.org_id)
    .single();
  if (orgErr || !org) throw new Error(`Could not load org: ${orgErr?.message}`);

  if (org.name !== DEMO_ORG_NAME) {
    throw new Error(
      `Refusing to reset: ${DEMO_EMAIL} currently belongs to org "${org.name}" (${org.id}), ` +
        `not "${DEMO_ORG_NAME}". Run scripts/setup_riverside_demo.ts first.`
    );
  }

  console.log(`[reset] wiping and reseeding "${DEMO_ORG_NAME}" (${org.id})...`);
  const result = await seedRiverside(supabase, org.id);
  console.log(`[reset] done. People: ${result.peopleCount}  Relationships: ${result.relationshipCount}  Messages: ${result.messageCount}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
