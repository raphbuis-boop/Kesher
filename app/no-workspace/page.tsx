import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { signOut } from "@/app/login/actions";
import { CreateWorkspaceButton } from "./CreateWorkspaceButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "No school yet — Kesher" };

/**
 * Where getMembership() sends a signed-in user with no membership: someone
 * removed from their team, or an invited user whose invite was revoked before
 * they accepted it.
 */
export default async function NoWorkspacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");

  const { count } = await supabase
    .from("memberships")
    .select("org_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) redirect("/dashboard");

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-canvas px-4 py-16">
      <div className="animate-pop-in w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-card">
        <h1 className="text-[17px] font-semibold tracking-tight text-ink">You&apos;re not part of a school</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          You don&apos;t have access to a school on Kesher right now. If you were removed by mistake or are waiting on an
          invite, ask your school&apos;s owner or an admin — then open the link in the invite email.
        </p>
        <div className="mt-6 space-y-2.5">
          <CreateWorkspaceButton />
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost btn-lg w-full">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
