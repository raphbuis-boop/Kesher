"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { saveSettings, type SettingsState } from "./actions";
import type { BrandingSettings } from "@/lib/settings";

const initialState: SettingsState = { success: false, error: null };

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] text-[#a1a1aa] leading-relaxed">{children}</p>;
}

const inputCls =
  "w-full rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#0f0f0f] placeholder-[#d4d4d8] outline-none transition-all duration-100 focus:border-[#a1a1aa] focus:bg-white disabled:opacity-50";

const textareaCls = inputCls + " resize-none leading-relaxed";

export function SettingsForm({ current }: { current: BrandingSettings }) {
  const [state, formAction, isPending] = useActionState(saveSettings, initialState);
  const [color, setColor] = useState(current.primaryColor || "#18181b");

  useEffect(() => {
    if (state.success) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.success]);

  return (
    <form action={formAction} noValidate className="space-y-6">
      {state.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
          Settings saved — outgoing emails will use the updated branding.
        </div>
      )}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {state.error}
        </div>
      )}

      {/* School Identity */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
          School Identity
        </h2>
        <div className="space-y-5 rounded-xl border border-[#e7e7e7] bg-white p-5">
          <div>
            <Label>School Name</Label>
            <input
              name="school_name"
              type="text"
              defaultValue={current.schoolName}
              placeholder="Lincoln Academy"
              className={inputCls}
              disabled={isPending}
            />
            <Hint>Appears in the email header and as the sender name fallback.</Hint>
          </div>

          <div>
            <Label>Logo URL</Label>
            <input
              name="school_logo_url"
              type="url"
              defaultValue={current.logoUrl}
              placeholder="https://yourschool.org/logo.png"
              className={inputCls}
              disabled={isPending}
            />
            <Hint>Displayed above the school name in every email. Must be a public URL. Recommended height: 60 px.</Hint>
          </div>

          <div>
            <Label>Primary Color</Label>
            <div className="flex items-center gap-3">
              <input
                name="primary_color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-[#e7e7e7] bg-white p-1 disabled:opacity-50"
                disabled={isPending}
              />
              <span className="font-mono text-[12px] text-[#71717a]">{color}</span>
            </div>
            <Hint>Used as the email header background color.</Hint>
          </div>
        </div>
      </section>

      {/* Sender & Reply */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
          Sender & Reply
        </h2>
        <div className="space-y-5 rounded-xl border border-[#e7e7e7] bg-white p-5">
          <div>
            <Label>Sender Name</Label>
            <input
              name="sender_name"
              type="text"
              defaultValue={current.senderName}
              placeholder="Lincoln Academy"
              className={inputCls}
              disabled={isPending}
            />
            <Hint>Shown as the "From" name in recipients' email clients. Falls back to School Name if blank.</Hint>
          </div>

          <div>
            <Label>Sender Email</Label>
            <input
              name="sender_email"
              type="email"
              defaultValue={current.senderEmail}
              placeholder="hello@yourschool.org"
              className={inputCls}
              disabled={isPending}
            />
            <Hint>The address emails are sent from. Must be on your verified sending domain.</Hint>
          </div>

          <div>
            <Label>Reply-To Email</Label>
            <input
              name="reply_to_email"
              type="email"
              defaultValue={current.replyToEmail}
              placeholder="office@yourschool.org"
              className={inputCls}
              disabled={isPending}
            />
            <Hint>When recipients hit "Reply," their message goes here. Leave blank to use the sending address.</Hint>
          </div>
        </div>
      </section>

      {/* Email Footer */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
          Email Footer
        </h2>
        <div className="space-y-5 rounded-xl border border-[#e7e7e7] bg-white p-5">
          <div>
            <Label>Footer Text</Label>
            <textarea
              name="footer_text"
              rows={3}
              defaultValue={current.footerText}
              placeholder="123 Main Street · Springfield · (212) 555-0100"
              className={textareaCls}
              disabled={isPending}
            />
            <Hint>Appears at the bottom of every email. Use for your address, phone, or a short tagline.</Hint>
          </div>

          <div>
            <Label>Website URL</Label>
            <input
              name="website_url"
              type="url"
              defaultValue={current.websiteUrl}
              placeholder="https://yourschool.org"
              className={inputCls}
              disabled={isPending}
            />
            <Hint>Displayed as a clickable link in the email footer.</Hint>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-[#0f0f0f] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#27272a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 size={12} className="animate-spin" />
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
