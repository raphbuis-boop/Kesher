"use client";

import { useActionState, useEffect, useState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import type { BrandingSettings } from "@/lib/settings";

const initialState: SettingsState = { success: false, error: null };

export function SettingsForm({ current }: { current: BrandingSettings }) {
  const [state, formAction, isPending] = useActionState(saveSettings, initialState);
  const [color, setColor] = useState(current.primaryColor || "#18181b");

  // Scroll to top on success to make the banner visible
  useEffect(() => {
    if (state.success) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.success]);

  const field =
    "w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 transition-colors disabled:opacity-50";

  return (
    <form action={formAction} noValidate>
      {state.success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Settings saved — outgoing emails will use the updated branding.
        </div>
      )}
      {state.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          School Identity
        </h2>
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              School Name
            </label>
            <input
              name="school_name"
              type="text"
              defaultValue={current.schoolName}
              placeholder="Lincoln Academy"
              className={field}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-zinc-400">
              Appears in the email header and as the sender name fallback.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Logo URL
            </label>
            <input
              name="school_logo_url"
              type="url"
              defaultValue={current.logoUrl}
              placeholder="https://yourschool.org/logo.png"
              className={field}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-zinc-400">
              Displayed above the school name in every email. Must be a public URL. Recommended height: 60 px.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                name="primary_color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-zinc-200 bg-white p-0.5 disabled:opacity-50"
                disabled={isPending}
              />
              <span className="font-mono text-sm text-zinc-500">{color}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Used as the email header background color.
            </p>
          </div>
        </div>
      </section>

      {/* ── Sender ───────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Sender & Reply
        </h2>
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Sender Name
            </label>
            <input
              name="sender_name"
              type="text"
              defaultValue={current.senderName}
              placeholder="Lincoln Academy"
              className={field}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-zinc-400">
              Shown as the "From" name in recipients' email clients. Falls back to School Name if blank.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Sender Email
            </label>
            <input
              name="sender_email"
              type="email"
              defaultValue={current.senderEmail}
              placeholder="hello@yourschool.org"
              className={field}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-zinc-400">
              The email address emails are sent from. Must be on your verified sending domain.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Reply-To Email
            </label>
            <input
              name="reply_to_email"
              type="email"
              defaultValue={current.replyToEmail}
              placeholder="office@yourschool.org"
              className={field}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-zinc-400">
              When recipients hit "Reply," their message goes to this address. Leave blank to use the sending address.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Email Footer
        </h2>
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Footer Text
            </label>
            <textarea
              name="footer_text"
              rows={3}
              defaultValue={current.footerText}
              placeholder="123 Main Street · Springfield · (212) 555-0100"
              className={field + " resize-none"}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-zinc-400">
              Appears at the bottom of every email. Use it for your address, phone number, or a short tagline.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Website URL
            </label>
            <input
              name="website_url"
              type="url"
              defaultValue={current.websiteUrl}
              placeholder="https://yourschool.org"
              className={field}
              disabled={isPending}
            />
            <p className="mt-1 text-xs text-zinc-400">
              Displayed as a clickable link in the email footer.
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Saving…
            </>
          ) : (
            "Save Settings"
          )}
        </button>
      </div>
    </form>
  );
}
