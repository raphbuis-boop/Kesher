"use server";

import { del } from "@vercel/blob";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getOrgId } from "@/lib/org";

export type SettingsState = {
  success: boolean;
  error: string | null;
};

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const FIELDS = [
  "school_name",
  "school_logo_url",
  "primary_color",
  "website_url",
  "footer_text",
  "reply_to_email",
  "sender_name",
  "sender_email",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Saves the School / email template settings. Only keys present in the form
 * are written, so a form that doesn't include (say) the logo can't blank it.
 */
export async function saveSettings(
  _prevState: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  const rows = FIELDS.filter((key) => formData.has(key)).map((key) => ({
    org_id: orgId,
    key,
    value: ((formData.get(key) as string) ?? "").trim(),
  }));

  for (const key of ["reply_to_email", "sender_email"] as const) {
    const v = rows.find((r) => r.key === key)?.value;
    if (v && !EMAIL_RE.test(v)) {
      return { success: false, error: `${key === "reply_to_email" ? "Reply-to" : "Sender"} email doesn't look valid.` };
    }
  }

  if (rows.length === 0) return { success: true, error: null };

  const { error } = await supabase
    .from("settings")
    .upsert(rows, { onConflict: "org_id,key" });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/messages");
  revalidatePath("/messages/new");
  revalidatePath("/dashboard");
  return { success: true, error: null };
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

async function currentLogoUrl(orgId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("org_id", orgId)
    .eq("key", "school_logo_url")
    .maybeSingle();
  return (data?.value as string | undefined)?.trim() ?? "";
}

/** True only for a logo this org uploaded via Settings (Blob path logos/<org_id>/…). */
function isOwnStoredLogo(url: string, orgId: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/logos/${orgId}/`);
  } catch {
    return false;
  }
}

/** Deletes a logo file from Blob storage — only ever one this org uploaded. */
async function deleteStoredLogo(url: string, orgId: string) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;
  if (!isOwnStoredLogo(url, orgId)) return; // external URL or not ours — never delete
  try {
    await del(url);
  } catch (err) {
    console.error("[settings] Failed to delete old logo blob:", err);
  }
}

/** Saves an uploaded logo URL (from /api/upload) and removes the previous file. */
export async function saveLogo(url: string): Promise<ActionResult> {
  if (!/^https:\/\//.test(url)) return { ok: false, error: "Invalid logo URL." };
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const previous = await currentLogoUrl(orgId);

  const { error } = await supabase
    .from("settings")
    .upsert({ org_id: orgId, key: "school_logo_url", value: url }, { onConflict: "org_id,key" });
  if (error) return { ok: false, error: error.message };

  if (previous && previous !== url) await deleteStoredLogo(previous, orgId);
  revalidatePath("/settings");
  return { ok: true, message: "Logo updated" };
}

/** Clears the logo setting and deletes the stored file. */
export async function removeLogo(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const previous = await currentLogoUrl(orgId);

  const { error } = await supabase
    .from("settings")
    .upsert({ org_id: orgId, key: "school_logo_url", value: "" }, { onConflict: "org_id,key" });
  if (error) return { ok: false, error: error.message };

  await deleteStoredLogo(previous, orgId);
  revalidatePath("/settings");
  return { ok: true, message: "Logo removed" };
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function updateProfileName(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const name = ((formData.get("full_name") as string | null) ?? "").trim().slice(0, 120);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (error) return { success: false, error: error.message };
  revalidatePath("/settings");
  return { success: true, error: null };
}

export async function changeEmail(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { success: false, error: "Enter a valid email address." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kesherhq.co"}/auth/callback` }
  );
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const current = (formData.get("current_password") as string | null) ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const confirm = (formData.get("confirm_password") as string | null) ?? "";

  if (password.length < 8) return { success: false, error: "New password must be at least 8 characters." };
  if (password !== confirm) return { success: false, error: "New passwords do not match." };

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const email = claimsData?.claims?.email as string | undefined;
  if (!email) return { success: false, error: "Your session has expired. Please sign in again." };

  // Confirm the current password before changing it
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (verifyError) return { success: false, error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

/**
 * Permanently deletes the school's workspace and the signed-in user.
 * Owner-only. The typed confirmation must match the school name (or the
 * phrase "delete my account" when no school name is set).
 *
 * Runs server-side with the service-role client, scoped explicitly to the
 * caller's own org_id. Deletes, in order:
 *   1. the org row, in one atomic statement that cascades (ON DELETE CASCADE)
 *      to people (→ person_tags, relationships), groups (→ group_tags), tags,
 *      messages (→ message_recipients), imports, import_jobs, message_threads
 *      (→ thread_messages), inbound_messages, settings and memberships
 *   2. the stored logo file (Vercel Blob)
 *   3. the auth user (their login)
 */
export async function deleteAccount(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const confirmation = ((formData.get("confirmation") as string | null) ?? "").trim();

  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { success: false, error: "Your session has expired. Please sign in again." };

  const [{ data: membership }, { data: nameRow }] = await Promise.all([
    supabase.from("memberships").select("role").eq("user_id", userId).eq("org_id", orgId).maybeSingle(),
    supabase.from("settings").select("value").eq("org_id", orgId).eq("key", "school_name").maybeSingle(),
  ]);
  if (membership?.role !== "owner") return { success: false, error: "Only the account owner can delete it." };

  const schoolName = (nameRow?.value as string | undefined)?.trim() ?? "";
  const expected = schoolName || "delete my account";
  if (confirmation.toLowerCase() !== expected.toLowerCase()) {
    return { success: false, error: `Type “${expected}” exactly to confirm.` };
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return { success: false, error: "Account deletion isn't configured on this server (missing service role key)." };
  }

  const logoUrl = await currentLogoUrl(orgId);

  // 1. One DELETE on the org row — atomic: either everything goes or nothing does
  const { error: orgError } = await admin.from("orgs").delete().eq("id", orgId);
  if (orgError) {
    console.error(`[deleteAccount] Failed deleting org ${orgId}:`, orgError.message);
    return { success: false, error: "Couldn't delete your school's data, so nothing was removed. Please contact support." };
  }

  // 2. Stored logo
  await deleteStoredLogo(logoUrl, orgId);

  // 3. The login itself
  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (userError) {
    console.error(`[deleteAccount] Org ${orgId} deleted but user ${userId} could not be removed:`, userError.message);
  }

  await supabase.auth.signOut();
  redirect("/");
}
