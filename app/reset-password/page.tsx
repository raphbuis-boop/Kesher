export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ResetPasswordClient } from "./ResetPasswordClient";

/**
 * Reached only via /auth/callback after Supabase exchanges a recovery code
 * for a session (see app/auth/callback/route.ts). If there's no valid
 * session here, the link was invalid, expired, or already used — show that
 * clearly instead of silently falling through to the home page.
 */
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-4 py-16">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#0f0f0f]">
            <span className="text-[15px] font-bold text-white tracking-tight select-none">K</span>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0f0f0f]">Kesher</h1>
        </div>
        <div className="w-full max-w-sm rounded-xl border border-[#e7e7e7] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] px-6 py-6">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700 leading-relaxed">
            This password reset link is invalid or has expired.
          </div>
          <Link
            href="/forgot-password"
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-[#0f0f0f] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#27272a]"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return <ResetPasswordClient />;
}
