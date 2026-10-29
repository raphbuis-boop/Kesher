import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getChannelConfig } from "@/lib/channels";
import { hasLinkKey, sha256, signToken, verifyToken } from "@/lib/crypto";
import { getAbsoluteBaseUrl } from "@/lib/site-url";
import { loadBrandingSettings } from "@/lib/settings";
import { toE164 } from "@/lib/phone";
import { isValidEmail } from "@/lib/validation";
import { RELATIONSHIPS } from "@/lib/signupOptions";
import { realSenders } from "@/lib/send/senders";

/**
 * Parent self-signup: a public link (and QR code) per school. A parent enters
 * themselves and their children, verifies their phone with a code, agrees to the
 * messaging terms (the exact wording, time and IP address are kept), and lands in
 * "Review new contacts" as pending people. Nobody gets a message until staff
 * approve them.
 */

// ─── Settings and the signed link ────────────────────────────────────────────

export type SignupSettings = { enabled: boolean; epoch: number; intro: string };

export async function getSignupSettings(supabase: SupabaseClient, orgId: string): Promise<SignupSettings> {
  const { data } = await supabase.from("settings").select("key, value").eq("org_id", orgId).in("key", ["signup_enabled", "signup_epoch", "signup_intro"]);
  const map = new Map(((data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const epoch = Number(map.get("signup_epoch"));
  return { enabled: map.get("signup_enabled") === "true", epoch: Number.isInteger(epoch) && epoch > 0 ? epoch : 1, intro: map.get("signup_intro") ?? "" };
}

/** The link on the poster / QR code. Changing the epoch kills every older link. */
export function buildSignupUrl(orgId: string, epoch: number): string | null {
  if (!hasLinkKey()) return null;
  const base = getAbsoluteBaseUrl();
  return base ? `${base}/join/${signToken("join", `${orgId}:${epoch}`)}` : null;
}

export async function resolveSignupToken(token: string): Promise<{ orgId: string; settings: SignupSettings; schoolName: string; logoUrl: string } | null> {
  const payload = verifyToken("join", token);
  if (!payload) return null;
  const [orgId, epochRaw] = payload.split(":");
  if (!orgId || !/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  const admin = createSupabaseAdminClient();
  const settings = await getSignupSettings(admin, orgId);
  if (!settings.enabled || settings.epoch !== Number(epochRaw)) return null;
  const branding = await loadBrandingSettings(admin, orgId);
  return { orgId, settings, schoolName: branding.schoolName, logoUrl: branding.logoUrl };
}

// ─── Consent wording (stored verbatim with each signup) ──────────────────────

export function smsConsentText(schoolName: string): string {
  const school = schoolName || "this school";
  return `I agree to receive text messages from ${school} about school news, events, closures and emergencies. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.`;
}

export function whatsappConsentText(schoolName: string): string {
  return `I agree to receive WhatsApp messages from ${schoolName || "this school"} about school news, events, closures and emergencies. I can reply STOP at any time to opt out.`;
}

// ─── Phone verification ──────────────────────────────────────────────────────

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_USE_WITHIN_MS = 30 * 60_000;
const SEND_LIMIT_PER_PHONE = 3;
const SEND_LIMIT_PER_IP = 8;

const hashCode = (id: string, code: string) => sha256(`otp:${id}:${code}`);

export type OtpResult = { ok: true; otpId: string } | { ok: false; error: string };

/** Can this school text a verification code? (Needs its own SMS number configured.) */
export async function canVerifyPhones(orgId: string): Promise<boolean> {
  try {
    return !!(await getChannelConfig(orgId)).sms;
  } catch {
    return false;
  }
}

export async function sendSignupCode(orgId: string, rawPhone: string, ip: string | null): Promise<OtpResult> {
  const phone = toE164(rawPhone);
  if (!phone) return { ok: false, error: "Enter a valid mobile number." };
  const admin = createSupabaseAdminClient();
  const cfg = await getChannelConfig(orgId);
  if (!cfg.sms) return { ok: false, error: "Text messages aren't set up for this school yet." };

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const [{ count: byPhone }, { count: byIp }] = await Promise.all([
    admin.from("signup_otps").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("phone", phone).gte("created_at", since),
    ip ? admin.from("signup_otps").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since) : Promise.resolve({ count: 0 }),
  ]);
  if ((byPhone ?? 0) >= SEND_LIMIT_PER_PHONE || (byIp ?? 0) >= SEND_LIMIT_PER_IP) return { ok: false, error: "Too many codes requested. Please wait a while and try again." };

  const id = crypto.randomUUID();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await admin.from("signup_otps").insert({ id, org_id: orgId, phone, code_hash: hashCode(id, code), expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(), ip });
  if (error) return { ok: false, error: "Couldn't send a code right now." };

  const branding = await loadBrandingSettings(admin, orgId);
  const res = await realSenders(cfg).sms({ to: phone, from: cfg.sms.sender, body: `${branding.schoolName || "Your school"}: your verification code is ${code}. It expires in 10 minutes.` });
  if (!res.providerId) {
    await admin.from("signup_otps").delete().eq("id", id);
    return { ok: false, error: "We couldn't text that number. Check it and try again." };
  }
  return { ok: true, otpId: id };
}

export async function verifySignupCode(orgId: string, otpId: string, rawPhone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const phone = toE164(rawPhone);
  if (!phone || !/^\d{6}$/.test(code.trim())) return { ok: false, error: "Enter the 6-digit code." };
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("signup_otps").select("id, code_hash, expires_at, attempts, verified_at").eq("org_id", orgId).eq("id", otpId).eq("phone", phone).maybeSingle();
  if (!data) return { ok: false, error: "That code isn't valid. Request a new one." };
  if (data.verified_at) return { ok: true };
  if (new Date(data.expires_at as string).getTime() < Date.now()) return { ok: false, error: "That code has expired. Request a new one." };
  if ((data.attempts as number) >= OTP_MAX_ATTEMPTS) return { ok: false, error: "Too many tries. Request a new code." };
  await admin.from("signup_otps").update({ attempts: (data.attempts as number) + 1 }).eq("id", otpId);
  const expected = Buffer.from(data.code_hash as string);
  const given = Buffer.from(hashCode(otpId, code.trim()));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { ok: false, error: "That code doesn't match." };
  await admin.from("signup_otps").update({ verified_at: new Date().toISOString() }).eq("id", otpId);
  return { ok: true };
}

/** Marks a verified code as used (once) and says whether it proves ownership of this phone. */
async function consumeVerifiedCode(admin: SupabaseClient, orgId: string, otpId: string, phone: string): Promise<boolean> {
  const { data } = await admin
    .from("signup_otps")
    .update({ used_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", otpId)
    .eq("phone", phone)
    .is("used_at", null)
    .not("verified_at", "is", null)
    .gte("verified_at", new Date(Date.now() - OTP_USE_WITHIN_MS).toISOString())
    .select("id");
  return !!data?.length;
}

// ─── The submission ──────────────────────────────────────────────────────────

export type SignupInput = {
  guardian: { firstName: string; lastName: string; relationship: string; email: string; phone: string };
  children: { firstName: string; lastName: string; grade: string }[];
  channels: { email: boolean; sms: boolean; whatsapp: boolean };
  agreeSms: boolean;
  agreeWhatsapp: boolean;
  otpId: string | null;
  /** Honeypot: real people leave it empty */
  website: string;
  /** Signed timestamp from when the form was shown */
  openedToken: string;
};

export type SignupResult = { ok: true; duplicate: boolean; phoneVerified: boolean } | { ok: false; error: string };

const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export function formOpenedToken(): string {
  return signToken("joinopen", String(Date.now()));
}

export async function submitSignup(
  orgId: string,
  raw: SignupInput,
  ip: string | null,
  userAgent: string | null,
  /** test overrides */
  deps: { admin?: SupabaseClient; canVerify?: boolean; schoolName?: string } = {}
): Promise<SignupResult> {
  // Bots: a filled honeypot, or a form "submitted" within 3 seconds of loading
  if (raw.website) return { ok: true, duplicate: false, phoneVerified: false };
  const openedAt = Number(verifyToken("joinopen", raw.openedToken));
  if (!openedAt || Date.now() - openedAt < 3_000) return { ok: false, error: "Please take a moment to fill in the form, then try again." };

  const g = raw.guardian;
  const first = clean(g.firstName, 60);
  const last = clean(g.lastName, 60);
  const email = clean(g.email, 200).toLowerCase();
  const phone = toE164(g.phone);
  if (!first || !last) return { ok: false, error: "Please enter your first and last name." };
  if (email && !isValidEmail(email)) return { ok: false, error: "That email address doesn't look right." };
  if (g.phone.trim() && !phone) return { ok: false, error: "That phone number doesn't look right." };
  if (!email && !phone) return { ok: false, error: "Add an email address or a mobile number so the school can reach you." };
  const channels = { email: !!raw.channels.email && !!email, sms: !!raw.channels.sms && !!phone, whatsapp: !!raw.channels.whatsapp && !!phone };
  if (!channels.email && !channels.sms && !channels.whatsapp) return { ok: false, error: "Choose how you'd like to hear from the school." };
  if (channels.sms && !raw.agreeSms) return { ok: false, error: "Please agree to receive text messages, or untick Text." };
  if (channels.whatsapp && !raw.agreeWhatsapp) return { ok: false, error: "Please agree to receive WhatsApp messages, or untick WhatsApp." };

  const kids = raw.children
    .map((c) => ({ first: clean(c.firstName, 60), last: clean(c.lastName, 60) || last, grade: clean(c.grade, 12) }))
    .filter((c) => c.first);
  if (kids.length === 0) return { ok: false, error: "Add at least one child." };
  if (kids.length > 10) return { ok: false, error: "That's a lot of children. Please add the rest by contacting the office." };

  const admin = deps.admin ?? createSupabaseAdminClient();
  const settings = await getSignupSettings(admin, orgId);
  if (!settings.enabled) return { ok: false, error: "Signup is closed right now." };

  // Per-IP limit on submissions
  if (ip) {
    const { count } = await admin.from("contact_preferences").select("person_id", { count: "exact", head: true }).eq("org_id", orgId).eq("sms_consent_ip", ip).gte("sms_consent_at", new Date(Date.now() - 3_600_000).toISOString());
    if ((count ?? 0) >= 6) return { ok: false, error: "Too many signups from this connection. Please try again later." };
  }

  // Phone proof: required whenever the school can text codes
  let phoneVerified = false;
  if (phone && (deps.canVerify ?? (await canVerifyPhones(orgId)))) {
    if (!raw.otpId || !(await consumeVerifiedCode(admin, orgId, raw.otpId, phone))) return { ok: false, error: "Please verify your phone number with the code we text you." };
    phoneVerified = true;
  }

  // Someone already waiting with this phone or email: don't pile up duplicates
  const dupes: string[] = [];
  if (phone) dupes.push(`phone.eq.${phone}`);
  if (email) dupes.push(`email.eq.${email}`);
  const { data: waiting } = await admin.from("people").select("id").eq("org_id", orgId).eq("status", "pending").eq("source_system", "signup").or(dupes.join(",")).limit(1);
  if (waiting?.length) return { ok: true, duplicate: true, phoneVerified };

  const schoolName = deps.schoolName ?? (await loadBrandingSettings(admin, orgId)).schoolName;
  const now = new Date().toISOString();

  const { data: household, error: hErr } = await admin.from("households").insert({ org_id: orgId, name: `${last} family`, source_system: "signup", status: "pending" }).select("id").single();
  if (hErr || !household) return { ok: false, error: "Something went wrong saving your signup. Please try again." };
  const householdId = household.id as string;

  const relationship = RELATIONSHIPS.some((r) => r.value === g.relationship) ? g.relationship : "guardian";
  const { data: parent, error: pErr } = await admin
    .from("people")
    .insert({
      org_id: orgId,
      first_name: first,
      last_name: last,
      email: email || null,
      phone: phone,
      whatsapp: channels.whatsapp ? phone : null,
      categories: ["parent"],
      parent_role: relationship === "mother" ? "mom" : relationship === "father" ? "dad" : null,
      status: "pending",
      source_system: "signup",
      household_id: householdId,
    })
    .select("id")
    .single();
  if (pErr || !parent) {
    await admin.from("households").delete().eq("id", householdId);
    return { ok: false, error: "Something went wrong saving your signup. Please try again." };
  }
  const parentId = parent.id as string;

  const { data: kidRows, error: kErr } = await admin
    .from("people")
    .insert(kids.map((c) => ({ org_id: orgId, first_name: c.first, last_name: c.last, grade: c.grade || null, categories: ["student"], status: "pending", source_system: "signup", household_id: householdId })))
    .select("id");
  if (kErr || !kidRows) {
    await admin.from("people").delete().eq("id", parentId);
    await admin.from("households").delete().eq("id", householdId);
    return { ok: false, error: "Something went wrong saving your signup. Please try again." };
  }
  await admin.from("guardian_students").insert((kidRows as { id: string }[]).map((k) => ({ org_id: orgId, guardian_id: parentId, student_id: k.id, relationship, custodial: true, receives_messages: true, source_system: "signup" })));

  const consentParts = [channels.sms ? smsConsentText(schoolName) : null, channels.whatsapp ? whatsappConsentText(schoolName) : null].filter(Boolean);
  await admin.from("contact_preferences").upsert(
    {
      person_id: parentId,
      org_id: orgId,
      email_enabled: channels.email,
      sms_enabled: channels.sms,
      whatsapp_enabled: channels.whatsapp,
      whatsapp_opt_in: channels.whatsapp ? true : null,
      sms_consent_at: consentParts.length ? now : null,
      sms_consent_text: consentParts.length ? consentParts.join("\n") : null,
      sms_consent_ip: ip,
      consent_source: "signup",
      phone_verified_at: phoneVerified ? now : null,
      updated_at: now,
    },
    { onConflict: "person_id" }
  );
  void userAgent;
  return { ok: true, duplicate: false, phoneVerified };
}
