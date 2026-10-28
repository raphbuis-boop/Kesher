import type { Metadata } from "next";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { hashInviteToken } from "@/lib/invites";
import { AcceptInviteButton, SwitchAccountButton } from "./AcceptInvite";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join your school — Kesher", robots: { index: false } };

type InvitePreview = {
  status: "valid" | "expired" | "accepted" | "revoked";
  school_name: string;
  email: string;
  role: "admin" | "member";
  inviter: string | null;
  expires_at: string;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#fafafa] px-4 py-16">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#0f0f0f]">
          <span className="text-[15px] font-bold text-white tracking-tight select-none">K</span>
        </div>
        <p className="text-[13px] text-[#71717a]">Kesher · School Communications</p>
      </div>
      <div className="animate-pop-in w-full max-w-sm rounded-xl border border-[#e7e7e7] bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </div>
  );
}

function Notice({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <Shell>
      <h1 className="text-[17px] font-semibold tracking-tight text-[#0f0f0f]">{title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#71717a]">{body}</p>
      {cta && <div className="mt-5">{cta}</div>}
    </Shell>
  );
}

/**
 * /invite/[token] — public. Shows who invited you to which school, then:
 * signed out → sign up or sign in (with ?next back here); signed in with the
 * invited email → Join; signed in as someone else → switch account.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: rows }, { data: claimsData }] = await Promise.all([
    supabase.rpc("get_invite", { p_token_hash: hashInviteToken(token) }),
    supabase.auth.getClaims(),
  ]);
  const invite = ((rows ?? []) as InvitePreview[])[0];
  const claims = claimsData?.claims;
  const signedInEmail = ((claims?.email as string | undefined) ?? "").toLowerCase();

  if (!invite) {
    return <Notice title="This invite link isn't valid" body="Check that you copied the whole link from your email, or ask your school for a new invite." />;
  }
  if (invite.status === "revoked") {
    return <Notice title="This invite was cancelled" body="Ask your school's owner or an admin to send a new one." />;
  }
  if (invite.status === "expired") {
    return <Notice title="This invite has expired" body="Invites last 7 days. Ask your school's owner or an admin to resend it." />;
  }
  if (invite.status === "accepted") {
    return (
      <Notice
        title="This invite has already been used"
        body="If that was you, sign in to get to your school."
        cta={<Link href="/dashboard" className="btn btn-primary btn-lg w-full">Go to Kesher</Link>}
      />
    );
  }

  const school = invite.school_name;
  const roleLabel = invite.role === "admin" ? "an admin" : "a team member";
  const next = `/invite/${token}`;
  const loginHref = (mode?: "signup") =>
    `/login?${new URLSearchParams({ next, email: invite.email, ...(mode ? { mode } : {}) }).toString()}`;

  // Does the signed-in user already belong to a school? (own rows only)
  let hasOtherSchool = false;
  if (claims?.sub && signedInEmail === invite.email) {
    const { count } = await supabase
      .from("memberships")
      .select("org_id", { count: "exact", head: true })
      .eq("user_id", claims.sub as string);
    hasOtherSchool = (count ?? 0) > 0;
  }

  return (
    <Shell>
      <h1 className="text-[17px] font-semibold tracking-tight text-[#0f0f0f]">Join {school}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#71717a]">
        {invite.inviter ? <span className="font-medium text-[#0f0f0f]">{invite.inviter}</span> : "Someone"} invited{" "}
        <span className="font-medium text-[#0f0f0f]">{invite.email}</span> to join as {roleLabel}.
      </p>

      <div className="mt-6 space-y-2.5">
        {!signedInEmail ? (
          <>
            <Link href={loginHref("signup")} className="btn btn-primary btn-lg w-full">Create your account</Link>
            <Link href={loginHref()} className="btn btn-secondary btn-lg w-full">I already have an account</Link>
          </>
        ) : signedInEmail === invite.email ? (
          <>
            {hasOtherSchool && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-800">
                You already have a Kesher workspace. Joining switches you to {school}; your current workspace
                won&apos;t be reachable from this login while you&apos;re on {school}&apos;s team.
              </p>
            )}
            <AcceptInviteButton token={token} schoolName={school} />
          </>
        ) : (
          <>
            <p className="rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#71717a]">
              You&apos;re signed in as <span className="font-medium text-[#0f0f0f]">{signedInEmail}</span>, but this invite is for{" "}
              <span className="font-medium text-[#0f0f0f]">{invite.email}</span>.
            </p>
            <SwitchAccountButton token={token} email={invite.email} />
          </>
        )}
      </div>

      <p className="mt-5 text-center text-[11px] text-[#a1a1aa]">
        Invite expires {new Date(invite.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </p>
    </Shell>
  );
}
