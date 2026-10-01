"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole, type Membership } from "@/lib/org";
import { getBrandingSettings } from "@/lib/settings";
import { INVITE_ROLES, inviteExpiry, newInviteToken, sendInviteEmail, type InviteRole } from "@/lib/invites";

/**
 * Team management. Every action checks the caller's role here (server-side),
 * and the database functions / RLS policies in scripts/migrate_teams.sql
 * enforce the same rules again — hiding buttons is never the only guard.
 */

export type TeamResult = { ok: true; message: string } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function guard(roles = ADMIN_ROLES): Promise<Membership | TeamResult> {
  try {
    return await requireRole(roles);
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}
function isResult(x: Membership | TeamResult): x is TeamResult {
  return "ok" in x;
}

async function inviterIdentity() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const meta = (claims?.user_metadata ?? {}) as { full_name?: string };
  return { name: meta.full_name?.trim() ?? "", email: (claims?.email as string | undefined) ?? "" };
}

async function emailInvite(to: string, token: string, role: InviteRole): Promise<TeamResult> {
  const [branding, inviter] = await Promise.all([getBrandingSettings(), inviterIdentity()]);
  const sent = await sendInviteEmail({
    to,
    token,
    role,
    schoolName: branding.schoolName,
    senderName: branding.senderName,
    inviterName: inviter.name,
    inviterEmail: inviter.email,
  });
  return sent.ok ? { ok: true, message: `Invite sent to ${to}` } : { ok: false, error: sent.error };
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function inviteMember(
  _prev: TeamResult | null,
  formData: FormData
): Promise<TeamResult> {
  const m = await guard();
  if (isResult(m)) return m;

  const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
  const role = (formData.get("role") as string | null) ?? "member";
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!INVITE_ROLES.includes(role as InviteRole)) return { ok: false, error: "Choose Admin or Member." };

  const supabase = await createSupabaseServerClient();

  // Already on the team?
  const { data: members } = await supabase.rpc("org_members", { p_org: m.orgId });
  if ((members ?? []).some((x: { email: string }) => x.email?.toLowerCase() === email)) {
    return { ok: false, error: `${email} is already on your team.` };
  }

  const { token, tokenHash } = newInviteToken();

  // One open invite per email: inviting again refreshes it (new token, new 7 days)
  const { data: existing } = await supabase
    .from("org_invites")
    .select("id")
    .eq("org_id", m.orgId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  const write = existing
    ? supabase
        .from("org_invites")
        .update({ token_hash: tokenHash, role, expires_at: inviteExpiry(), invited_by: m.userId })
        .eq("id", existing.id)
        .eq("org_id", m.orgId)
    : supabase.from("org_invites").insert({
        org_id: m.orgId,
        email,
        role,
        token_hash: tokenHash,
        invited_by: m.userId,
        expires_at: inviteExpiry(),
      });
  const { error } = await write;
  if (error) return { ok: false, error: `Couldn't create the invite: ${error.message}` };

  revalidatePath("/settings");
  const sent = await emailInvite(email, token, role as InviteRole);
  if (!sent.ok) return { ok: false, error: `${sent.error} The invite was saved — use Resend to try again.` };
  return sent;
}

export async function resendInvite(inviteId: string): Promise<TeamResult> {
  const m = await guard();
  if (isResult(m)) return m;
  const supabase = await createSupabaseServerClient();

  const { data: invite } = await supabase
    .from("org_invites")
    .select("id, email, role")
    .eq("id", inviteId)
    .eq("org_id", m.orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (!invite) return { ok: false, error: "That invite is no longer pending." };

  // New token (the old link stops working) and a fresh 7-day window
  const { token, tokenHash } = newInviteToken();
  const { error } = await supabase
    .from("org_invites")
    .update({ token_hash: tokenHash, expires_at: inviteExpiry(), invited_by: m.userId })
    .eq("id", invite.id)
    .eq("org_id", m.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return emailInvite(invite.email as string, token, invite.role as InviteRole);
}

export async function revokeInvite(inviteId: string): Promise<TeamResult> {
  const m = await guard();
  if (isResult(m)) return m;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("org_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId)
    .eq("org_id", m.orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("email");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That invite is no longer pending." };
  revalidatePath("/settings");
  return { ok: true, message: `Invite to ${data[0].email} revoked` };
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function changeMemberRole(userId: string, role: string): Promise<TeamResult> {
  const m = await guard();
  if (isResult(m)) return m;
  if (!INVITE_ROLES.includes(role as InviteRole)) return { ok: false, error: "Choose Admin or Member." };
  if (userId === m.userId) return { ok: false, error: "You can't change your own role." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_member_role", { p_org: m.orgId, p_user: userId, p_role: role });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true, message: `Role changed to ${role}` };
}

export async function removeMember(userId: string): Promise<TeamResult> {
  const m = await guard();
  if (isResult(m)) return m;
  if (userId === m.userId) return { ok: false, error: "You can't remove yourself." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_member", { p_org: m.orgId, p_user: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true, message: "Removed from the team" };
}

export async function transferOwnership(userId: string): Promise<TeamResult> {
  const m = await guard(["owner"]);
  if (isResult(m)) return m;
  if (userId === m.userId) return { ok: false, error: "You already own this account." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transfer_ownership", { p_org: m.orgId, p_user: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true, message: "Ownership transferred — you're now an admin" };
}
