"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordClient() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await requestPasswordReset({ success: false, error: null }, fd);
      if (res.error) setError(res.error);
      else setSent(true);
    });
  }

  const inputClass =
    "w-full rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-3 py-2.5 text-[13px] text-[#0f0f0f] placeholder-[#a1a1aa] outline-none transition-all focus:border-[#a1a1aa] focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-4 py-16">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#0f0f0f]">
          <span className="text-[15px] font-bold text-white tracking-tight select-none">K</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[#0f0f0f]">Kesher</h1>
        <p className="text-[13px] text-[#71717a]">Reset your password</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-[#e7e7e7] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] px-6 py-6">
        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-700 leading-relaxed">
              If an account exists for that email, we&apos;ve sent a link to reset your password. Check your inbox.
            </div>
            <Link
              href="/login"
              className="text-center text-[13px] font-medium text-[#71717a] hover:text-[#0f0f0f] transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-[12px] text-[#71717a] leading-relaxed">
              Enter the email address on your account and we&apos;ll send you a link to reset your password.
            </p>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700 leading-relaxed">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-email" className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                Email
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@school.edu"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f0f0f] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#27272a] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Sending…
                </>
              ) : (
                "Send reset link"
              )}
            </button>

            <Link
              href="/login"
              className="text-center text-[13px] font-medium text-[#71717a] hover:text-[#0f0f0f] transition-colors"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
