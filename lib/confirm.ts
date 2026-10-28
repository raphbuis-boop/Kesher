import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { loadBrandingSettings } from "@/lib/settings";

/**
 * "I've read this" — the one engagement signal that is certain. The link in a
 * message carries a signed id for one message_recipients row; the page asks for
 * a tap before recording anything (so link scanners that fetch the URL can't
 * confirm on anyone's behalf).
 */

export type ConfirmContext = {
  rowId: string;
  orgId: string;
  messageId: string;
  personId: string;
  firstName: string;
  confirmedAt: string | null;
  subject: string | null;
  preview: string;
  schoolName: string;
  logoUrl: string;
  primaryColor: string;
};

export async function getConfirmContext(rowId: string): Promise<ConfirmContext | null> {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("message_recipients")
    .select("id, message_id, person_id, name, confirmed_at, messages!inner(org_id, subject, body)")
    .eq("id", rowId)
    .maybeSingle();
  if (!row) return null;
  const message = (row as unknown as { messages: { org_id: string; subject: string | null; body: string } }).messages;
  const branding = await loadBrandingSettings(admin, message.org_id);
  const body = message.body.replace(/\{\{[^}]+\}\}/g, "").replace(/\s+/g, " ").trim();
  return {
    rowId: row.id as string,
    orgId: message.org_id,
    messageId: row.message_id as string,
    personId: row.person_id as string,
    firstName: String(row.name ?? "").split(" ")[0] ?? "",
    confirmedAt: (row.confirmed_at as string | null) ?? null,
    subject: message.subject,
    preview: body.length > 160 ? `${body.slice(0, 160)}…` : body,
    schoolName: branding.schoolName,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
  };
}

/** Marks this person as having read the message, on every channel it was sent to them. */
export async function confirmRead(rowId: string): Promise<boolean> {
  const ctx = await getConfirmContext(rowId);
  if (!ctx) return false;
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("message_recipients")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("message_id", ctx.messageId)
    .eq("person_id", ctx.personId)
    .is("confirmed_at", null);
  return !error;
}
