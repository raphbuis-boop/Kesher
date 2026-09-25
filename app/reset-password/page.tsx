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
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary">
            <span className="text-[15px] font-bold text-primary-fg tracking-tight select-none">K</span>
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">Kesher</h1>
        </div>
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-[0_2px_16px_rgba(0,0,0,0.06)] px-6 py-6">
          <div className="rounded-lg border border-danger-border bg-danger-tint px-3.5 py-2.5 text-[12px] text-danger leading-relaxed">
            This password reset link is invalid or has expired.
          </div>
          <Link
            href="/forgot-password"
            className="mt-4 flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-fg transition-colors hover:bg-primary-hover"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return <ResetPasswordClient />;
}
