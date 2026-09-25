"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn, signUp } from "./actions";

type Tab = "signin" | "signup";

export function LoginClient({ next }: { next?: string }) {
  const [tab, setTab]                     = useState<Tab>("signin");
  const [showPassword, setShowPassword]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState<string | null>(null);
  const [isPending, startTransition]      = useTransition();

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    setSuccess(null);
  }

  function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signIn(fd);
      if (res?.error) setError(res.error);
      // On success, signIn calls redirect() server-side → page navigates automatically
    });
  }

  function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await signUp(fd);
      if (res?.error) setError(res.error);
      else if (res?.success) setSuccess(res.success);
    });
  }

  const inputClass =
    "w-full rounded-lg border border-border-input bg-background px-3 py-2.5 text-[13px] text-text-primary placeholder-text-subtle transition-all focus:border-focus-ring focus:bg-surface focus:shadow-[0_0_0_3px_rgba(0,0,0,0.04)]";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      {/* Wordmark */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary">
          <span className="text-[15px] font-bold text-primary-fg tracking-tight select-none">K</span>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">Kesher</h1>
        <p className="text-[13px] text-text-muted">School Communications</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        {/* Tab switcher */}
        <div className="flex border-b border-border-subtle">
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => switchTab(t)}
              className={[
                "flex-1 py-3.5 text-[13px] font-medium transition-colors",
                tab === t
                  ? "text-text-primary border-b-2 border-primary -mb-px"
                  : "text-text-subtle hover:text-text-muted",
              ].join(" ")}
            >
              {t === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <div className="px-6 py-6">
          {/* Error banner */}
          {error && (
            <div role="alert" className="mb-4 rounded-lg border border-danger-border bg-danger-tint px-3.5 py-2.5 text-[12px] text-danger leading-relaxed">
              {error}
            </div>
          )}

          {/* Success banner */}
          {success && (
            <div className="mb-4 rounded-lg border border-success-border bg-success-tint px-3.5 py-2.5 text-[12px] text-success leading-relaxed">
              {success}
            </div>
          )}

          {/* ── Sign in form ── */}
          {tab === "signin" && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <input type="hidden" name="next" value={next ?? "/dashboard"} />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="signin-email" className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  Email
                </label>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@school.edu"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="signin-password" className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="signin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-muted transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword
                      ? <EyeOff size={14} strokeWidth={1.75} />
                      : <Eye    size={14} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          )}

          {/* ── Sign up form ── */}
          {tab === "signup" && !success && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-email" className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  Email
                </label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@school.edu"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="signup-password" className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    className={inputClass + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-muted transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword
                      ? <EyeOff size={14} strokeWidth={1.75} />
                      : <Eye    size={14} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </button>
            </form>
          )}

          {/* Post-signup success state — just the banner, no form */}
          {tab === "signup" && success && (
            <button
              type="button"
              onClick={() => switchTab("signin")}
              className="mt-2 w-full rounded-lg border border-border bg-background px-4 py-2.5 text-[13px] font-medium text-text-muted hover:bg-surface hover:text-text-primary transition-all"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>

      {/* Legal note */}
      <p className="mt-6 text-center text-[11px] text-text-subtle max-w-xs leading-relaxed">
        By continuing you agree to our{" "}
        <a href="/terms" className="underline underline-offset-2 hover:text-text-muted transition-colors">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline underline-offset-2 hover:text-text-muted transition-colors">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
