/**
 * READ-ONLY inspection script.
 * Prints org/membership/data-count structure so we can safely identify
 * which org_id belongs to contact@kesherhq.co before changing anything.
 * Never prints secret values — only env var NAMES that are present.
 *
 * Run: npx tsx scripts/inspect_orgs.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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
      // .env.local takes priority; only fill in gaps from .env.vercel (e.g. service role key)
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.vercel");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const TABLES_TO_COUNT = [
  "people", "groups", "tags", "messages", "import_jobs",
  "message_threads", "settings", "imports", "relationships",
];

async function main() {
  console.log("\n── auth users ──");
  const { data: userList, error: userErr } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (userErr) { console.error("listUsers error:", userErr.message); process.exit(1); }
  for (const u of userList.users) {
    console.log(` - id=${u.id}  email=${u.email}  created=${u.created_at}`);
  }

  console.log("\n── orgs ──");
  const { data: orgs, error: orgsErr } = await supabase.from("orgs").select("id, name, created_at").order("created_at");
  if (orgsErr) { console.error("orgs error:", orgsErr.message); process.exit(1); }
  for (const o of orgs ?? []) {
    console.log(` - org_id=${o.id}  name="${o.name}"  created=${o.created_at}`);
  }

  console.log("\n── memberships (user -> org) ──");
  const { data: memberships, error: memErr } = await supabase.from("memberships").select("user_id, org_id, role");
  if (memErr) { console.error("memberships error:", memErr.message); process.exit(1); }
  const emailById = new Map(userList.users.map((u) => [u.id, u.email]));
  for (const m of memberships ?? []) {
    console.log(` - user=${emailById.get(m.user_id) ?? m.user_id}  org_id=${m.org_id}  role=${m.role}`);
  }

  console.log("\n── row counts per org per table ──");
  for (const o of orgs ?? []) {
    const counts: string[] = [];
    for (const t of TABLES_TO_COUNT) {
      try {
        const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true }).eq("org_id", o.id);
        counts.push(`${t}=${error ? "err" : count}`);
      } catch {
        counts.push(`${t}=n/a`);
      }
    }
    console.log(` - org "${o.name}" (${o.id}): ${counts.join(", ")}`);
  }

  console.log("\n── settings rows per org ──");
  for (const o of orgs ?? []) {
    const { data: settingsRows } = await supabase.from("settings").select("key, value").eq("org_id", o.id);
    console.log(` - org "${o.name}": `, settingsRows);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
