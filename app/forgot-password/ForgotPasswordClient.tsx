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
    "w-full rounded-lg border border-border-input bg-background px-3 py-2.5 text-[13px] text-text-primary placeholder-text-subtle transition-all focus:border-focus-ring focus:bg-surface focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary">
          <span className="text-[15px] font-bold text-primary-fg tracking-tight select-none">K</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">Kesher</h1>
        <p className="text-[13px] text-text-muted">Reset your password</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-[0_2px_16px_rgba(0,0,0,0.06)] px-6 py-6">
        {sent ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-success-border bg-success-tint px-3.5 py-2.5 text-[12px] text-success leading-relaxed">
              If an account exists for that email, we&apos;ve sent a link to reset your password. Check your inbox.
            </div>
            <Link
              href="/login"
              className="text-center text-[13px] font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-[12px] text-text-muted leading-relaxed">
              Enter the email address on your account and we&apos;ll send you a link to reset your password.
            </p>

            {error && (
              <div role="alert" className="rounded-lg border border-danger-border bg-danger-tint px-3.5 py-2.5 text-[12px] text-danger leading-relaxed">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="forgot-email" className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
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
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
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
              className="text-center text-[13px] font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
