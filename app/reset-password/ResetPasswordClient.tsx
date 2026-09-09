"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { updatePassword } from "./actions";

export function ResetPasswordClient() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updatePassword({ error: null }, fd);
      // On success, updatePassword() redirects server-side — this only
      // ever returns when there was an error.
      if (res?.error) setError(res.error);
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
        <p className="text-[13px] text-[#71717a]">Choose a new password</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-[#e7e7e7] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] px-6 py-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700 leading-relaxed">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-password" className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#71717a] transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={14} strokeWidth={1.75} /> : <Eye size={14} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-password" className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Confirm password
            </label>
            <input
              id="confirm-password"
              name="confirm_password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Re-enter your new password"
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
                Saving…
              </>
            ) : (
              "Save password"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
