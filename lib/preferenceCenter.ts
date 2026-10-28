import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadBrandingSettings } from "@/lib/settings";
import { DEFAULT_PREFERENCES, type ContactPreferences } from "@/lib/preferences";
import { getGroup, resolveGroupMemberIds } from "@/lib/audienceMembers";
import { toE164 } from "@/lib/phone";
import { isValidEmail } from "@/lib/validation";
import { smsConsentText, whatsappConsentText } from "@/lib/signup";
import { isActiveSuppression } from "@/lib/suppressions";

/**
 * The page a parent reaches from the footer of any message, without logging in:
 * which channels, which groups, emergency-only, language — and a full stop.
 * Everything is scoped to the one person the signed link was made for.
 */

export type PrefGroup = { id: string; name: string; muted: boolean };

export type PreferenceContext = {
  personId: string;
  orgId: string;
  firstName: string;
  schoolName: string;
  logoUrl: string;
  email: string | null;
  phone: string | null;
  prefs: ContactPreferences;
  hasEmail: boolean;
  hasPhone: boolean;
  groups: PrefGroup[];
  /** Channels this person has hard-stopped (STOP / unsubscribe) */
  stopped: { email: boolean; sms: boolean; whatsapp: boolean };
  smsConsent: string;
  whatsappConsent: string;
};

const mask = (v: string | null, kind: "email" | "phone") => {
  if (!v) return null;
  if (kind === "email") {
    const [name, domain] = v.split("@");
    return `${name.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(6, name.length - 1)))}@${domain ?? ""}`;
  }
  return `••• ••• ${v.replace(/\D/g, "").slice(-4)}`;
};

export async function getPreferenceContext(personId: string, client?: SupabaseClient): Promise<PreferenceContext | null> {
  const admin = client ?? createSupabaseAdminClient();
  const { data: person } = await admin
    .from("people")
    .select("id, org_id, first_name, email, phone, whatsapp, status, categories")
    .eq("id", personId)
    .maybeSingle();
  if (!person || person.status === "rejected") return null;
  const orgId = person.org_id as string;

  const [{ data: prefRow }, branding, { data: groupRows }, { data: kidLinks }] = await Promise.all([
    admin.from("contact_preferences").select("*").eq("org_id", orgId).eq("person_id", personId).maybeSingle(),
    loadBrandingSettings(admin, orgId),
    admin.from("groups").select("id").eq("org_id", orgId).order("name").limit(60),
    admin.from("guardian_students").select("student_id").eq("org_id", orgId).eq("guardian_id", personId),
  ]);
  const prefs: ContactPreferences = { ...DEFAULT_PREFERENCES, ...((prefRow as Partial<ContactPreferences> | null) ?? {}) };

  // Only groups this parent (or their children) actually belong to
  const mine = new Set([personId, ...((kidLinks ?? []) as { student_id: string }[]).map((l) => l.student_id)]);
  const groups: PrefGroup[] = [];
  for (const g of (groupRows ?? []) as { id: string }[]) {
    const group = await getGroup(admin, orgId, g.id);
    if (!group) continue;
    const members = await resolveGroupMemberIds(admin, orgId, group);
    if (members.some((m) => mine.has(m))) groups.push({ id: group.id, name: group.name, muted: prefs.muted_group_ids.includes(group.id) });
  }

  const email = (person.email as string | null)?.trim().toLowerCase() || null;
  const phone = toE164((person.whatsapp as string | null) || (person.phone as string | null));
  const stopped = {
    email: email ? await isActiveSuppression(admin, orgId, "email", email) : false,
    sms: phone ? await isActiveSuppression(admin, orgId, "sms", phone) : false,
    whatsapp: phone ? await isActiveSuppression(admin, orgId, "whatsapp", phone) : false,
  };

  return {
    personId,
    orgId,
    firstName: person.first_name as string,
    schoolName: branding.schoolName,
    logoUrl: branding.logoUrl,
    email,
    phone,
    prefs,
    hasEmail: !!email && isValidEmail(email),
    hasPhone: !!phone,
    groups,
    stopped,
    smsConsent: smsConsentText(branding.schoolName),
    whatsappConsent: whatsappConsentText(branding.schoolName),
  };
}

export const maskedEmail = (c: PreferenceContext) => mask(c.email, "email");
export const maskedPhone = (c: PreferenceContext) => mask(c.phone, "phone");

export type PreferenceUpdate = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  emergencyOnly: boolean;
  mutedGroupIds: string[];
  language: string | null;
  /** Ticked when turning texts or WhatsApp on that were off */
  agreeSms: boolean;
  agreeWhatsapp: boolean;
};

export async function savePreferenceUpdate(personId: string, update: PreferenceUpdate, ip: string | null, client?: SupabaseClient): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getPreferenceContext(personId, client);
  if (!ctx) return { ok: false, error: "This link isn't valid." };
  const before = ctx.prefs;
  const admin = client ?? createSupabaseAdminClient();
  const now = new Date().toISOString();

  const turningOnSms = update.sms && !before.sms_enabled;
  const turningOnWa = update.whatsapp && !before.whatsapp_enabled;
  if (update.sms && !ctx.hasPhone) return { ok: false, error: "There's no mobile number on file for texts. Ask the office to add one." };
  if (update.whatsapp && !ctx.hasPhone) return { ok: false, error: "There's no mobile number on file for WhatsApp. Ask the office to add one." };
  if (update.email && !ctx.hasEmail) return { ok: false, error: "There's no email address on file. Ask the office to add one." };
  if (turningOnSms && !update.agreeSms) return { ok: false, error: "Please tick the box to agree to receive text messages." };
  if (turningOnWa && !update.agreeWhatsapp) return { ok: false, error: "Please tick the box to agree to receive WhatsApp messages." };

  // Only groups this person is actually in can be muted (keeps the list from being used to probe other group ids)
  const allowed = new Set(ctx.groups.map((g) => g.id));
  const muted = [...new Set(update.mutedGroupIds)].filter((id) => allowed.has(id));
  const language = update.language && /^[a-z]{2}$/.test(update.language) ? update.language : null;

  const row: Record<string, unknown> = {
    person_id: personId,
    org_id: ctx.orgId,
    email_enabled: update.email,
    sms_enabled: update.sms,
    whatsapp_enabled: update.whatsapp,
    emergency_only: update.emergencyOnly,
    muted_group_ids: muted,
    language,
    updated_at: now,
  };
  if (turningOnWa) row.whatsapp_opt_in = true;
  if (turningOnSms || turningOnWa) {
    row.sms_consent_at = now;
    row.sms_consent_text = [turningOnSms ? ctx.smsConsent : null, turningOnWa ? ctx.whatsappConsent : null].filter(Boolean).join("\n");
    row.sms_consent_ip = ip;
    row.consent_source = "preference_center";
  }
  const { error } = await admin.from("contact_preferences").upsert(row, { onConflict: "person_id" });
  if (error) return { ok: false, error: "Couldn't save your choices. Please try again." };
  return { ok: true };
}
