import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The SMS consent certification a school makes every time contacts enter Kesher:
 * a file import, connecting or syncing a Google Sheet, or adding a contact with a
 * phone number by hand. The exact wording is shown on the public compliance pages
 * (app/cta, app/opt-in) from this same constant, so the product and the site
 * can't drift apart.
 */
export const SMS_CONSENT_CERTIFICATION =
  "By importing these contacts, I certify that all individuals on this list have provided explicit, written or digital consent to receive SMS text messages from our school via the Kesher platform. I acknowledge that it is the school's responsibility to maintain accurate consent records and to honor all opt-out requests in accordance with TCPA and CTIA guidelines.";

export type CertificationContext = "file_import" | "sheet_connect" | "sheet_sync" | "sheet_auto_sync" | "contact_create";

export const NOT_CERTIFIED_ERROR = "Please tick the consent certification box first. Kesher can't add contacts without it.";

/** Records the certification under the signed-in user (RLS only allows certifying as yourself). */
export async function recordCertification(
  supabase: SupabaseClient,
  input: { orgId: string; userId: string; context: CertificationContext; sourceId?: string | null; runId?: string | null; personId?: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: claims } = await supabase.auth.getClaims();
  const email = (claims?.claims as { email?: string } | undefined)?.email ?? null;
  const { error } = await supabase.from("consent_certifications").insert({
    org_id: input.orgId,
    user_id: input.userId,
    user_email: email,
    context: input.context,
    text: SMS_CONSENT_CERTIFICATION,
    sync_source_id: input.sourceId ?? null,
    sync_run_id: input.runId ?? null,
    person_id: input.personId ?? null,
  });
  return error ? { ok: false, error: `Couldn't record the consent certification: ${error.message}` } : { ok: true };
}
