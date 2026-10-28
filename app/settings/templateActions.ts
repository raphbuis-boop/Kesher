"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";

export type TemplateResult = { ok: true; id?: string; message?: string } | { ok: false; error: string };

export type TemplateInput = {
  name: string;
  logo_url: string;
  primary_color: string;
  background_color: string;
  sender_name: string;
  default_subject: string;
  footer_text: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

async function admin(): Promise<{ orgId: string } | TemplateResult> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    return { orgId };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

function clean(input: TemplateInput): { row: Record<string, string | null> } | { error: string } {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Give the template a name." };
  const color = (v: string, label: string) => {
    const t = v.trim();
    if (!t) return null;
    if (!HEX.test(t)) throw new Error(`${label} must look like #1e3a6e.`);
    return t.toLowerCase();
  };
  const logo = input.logo_url.trim();
  if (logo && !/^https:\/\//i.test(logo)) return { error: "The logo must be a secure (https) image link." };
  try {
    return {
      row: {
        name,
        logo_url: logo || null,
        primary_color: color(input.primary_color, "Header color"),
        background_color: color(input.background_color, "Background color"),
        sender_name: input.sender_name.trim().slice(0, 100) || null,
        default_subject: input.default_subject.trim().slice(0, 200) || null,
        footer_text: input.footer_text.trim().slice(0, 1000) || null,
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid template." };
  }
}

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/messages/new");
}

export async function createTemplate(input: TemplateInput): Promise<TemplateResult> {
  const g = await admin();
  if ("ok" in g) return g;
  const c = clean(input);
  if ("error" in c) return { ok: false, error: c.error };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("message_templates").insert({ org_id: g.orgId, ...c.row }).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? `You already have a template called "${c.row.name}".` : error.message };
  refresh();
  return { ok: true, id: data.id as string };
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<TemplateResult> {
  const g = await admin();
  if ("ok" in g) return g;
  const c = clean(input);
  if ("error" in c) return { ok: false, error: c.error };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("message_templates")
    .update({ ...c.row, updated_at: new Date().toISOString() })
    .eq("org_id", g.orgId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.code === "23505" ? `You already have a template called "${c.row.name}".` : error.message };
  if (!data) return { ok: false, error: "Template not found." };
  refresh();
  return { ok: true };
}

/** "Basketball" → "Basketball (copy)", then "(copy 2)"… */
export async function duplicateTemplate(id: string): Promise<TemplateResult> {
  const g = await admin();
  if ("ok" in g) return g;
  const supabase = await createSupabaseServerClient();
  const { data: src } = await supabase
    .from("message_templates")
    .select("name, logo_url, primary_color, background_color, sender_name, default_subject, footer_text")
    .eq("org_id", g.orgId)
    .eq("id", id)
    .maybeSingle();
  if (!src) return { ok: false, error: "Template not found." };
  const { data: names } = await supabase.from("message_templates").select("name").eq("org_id", g.orgId);
  const taken = new Set((names ?? []).map((n) => n.name as string));
  let name = `${src.name} (copy)`;
  for (let i = 2; taken.has(name); i++) name = `${src.name} (copy ${i})`;
  const { data, error } = await supabase.from("message_templates").insert({ org_id: g.orgId, ...src, name }).select("id").single();
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, id: data.id as string, message: `Created "${name}"` };
}

export async function deleteTemplate(id: string): Promise<TemplateResult> {
  const g = await admin();
  if ("ok" in g) return g;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("message_templates").delete().eq("org_id", g.orgId).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Sets which audiences use this template by default (replaces this template's current assignments). */
export async function setTemplateAudiences(templateId: string, slugs: string[]): Promise<TemplateResult> {
  const g = await admin();
  if ("ok" in g) return g;
  const supabase = await createSupabaseServerClient();
  const { data: tpl } = await supabase.from("message_templates").select("id").eq("org_id", g.orgId).eq("id", templateId).maybeSingle();
  if (!tpl) return { ok: false, error: "Template not found." };

  const unique = [...new Set(slugs.filter((s) => typeof s === "string" && s.length > 0 && s.length <= 64))];
  const { error: delError } = await supabase.from("audience_templates").delete().eq("org_id", g.orgId).eq("template_id", templateId);
  if (delError) return { ok: false, error: delError.message };
  if (unique.length > 0) {
    // An audience has one default template: taking it over replaces the previous one
    const { error } = await supabase
      .from("audience_templates")
      .upsert(unique.map((audience_slug) => ({ org_id: g.orgId, audience_slug, template_id: templateId })), { onConflict: "org_id,audience_slug" });
    if (error) return { ok: false, error: error.message };
  }
  refresh();
  return { ok: true };
}
