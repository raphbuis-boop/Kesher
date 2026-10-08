"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { saveSettings, type SettingsState } from "./actions";
import type { BrandingSettings } from "@/lib/settings";

const initialState: SettingsState = { success: false, error: null };

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-text-secondary">
      {children}
    </label>
  );
}

function Hint({ id, children }: { id: string; children: React.ReactNode }) {
  return <p id={id} className="mt-1.5 text-[11px] text-text-subtle leading-relaxed">{children}</p>;
}

const inputCls =
  "w-full rounded-lg border border-border-input bg-background px-3 py-2 text-[13px] text-text-primary placeholder-text-subtle transition-all duration-100 focus:border-focus-ring focus:bg-surface disabled:opacity-50";

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
        <div className="rounded-lg border border-success-border bg-success-tint px-4 py-3 text-[13px] text-success">
          Settings saved — outgoing emails will use the updated branding.
        </div>
      )}
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger-border bg-danger-tint px-4 py-3 text-[13px] text-danger">
          {state.error}
        </div>
      )}

      {/* School Identity */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
          School Identity
        </h2>
        <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
          <div>
            <Label htmlFor="settings_school_name">School Name</Label>
            <input
              id="settings_school_name"
              aria-describedby="settings_school_name_hint"
              name="school_name"
              type="text"
              defaultValue={current.schoolName}
              placeholder="Lincoln Academy"
              className={inputCls}
              disabled={isPending}
            />
            <Hint id="settings_school_name_hint">Appears in the email header and as the sender name fallback.</Hint>
          </div>

          <div>
            <Label htmlFor="settings_school_logo_url">Logo URL</Label>
            <input
              id="settings_school_logo_url"
              aria-describedby="settings_school_logo_url_hint"
              name="school_logo_url"
              type="url"
              defaultValue={current.logoUrl}
              placeholder="https://yourschool.org/logo.png"
              className={inputCls}
              disabled={isPending}
            />
            <Hint id="settings_school_logo_url_hint">Displayed above the school name in every email. Must be a public URL. Recommended height: 60 px.</Hint>
          </div>

          <div>
            <Label htmlFor="settings_primary_color">Primary Color</Label>
            <div className="flex items-center gap-3">
              <input
                id="settings_primary_color"
                aria-describedby="settings_primary_color_hint"
                name="primary_color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-lg border border-border-input bg-surface p-1 disabled:opacity-50"
                disabled={isPending}
              />
              <span className="font-mono text-[12px] text-text-muted">{color}</span>
            </div>
            <Hint id="settings_primary_color_hint">Used as the email header background color.</Hint>
          </div>
        </div>
      </section>

      {/* Sender & Reply */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
          Sender & Reply
        </h2>
        <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
          <div>
            <Label htmlFor="settings_sender_name">Sender Name</Label>
            <input
              id="settings_sender_name"
              aria-describedby="settings_sender_name_hint"
              name="sender_name"
              type="text"
              defaultValue={current.senderName}
              placeholder="Lincoln Academy"
              className={inputCls}
              disabled={isPending}
            />
            <Hint id="settings_sender_name_hint">Shown as the "From" name in recipients' email clients. Falls back to School Name if blank.</Hint>
          </div>

          <div>
            <Label htmlFor="settings_sender_email">Sender Email</Label>
            <input
              id="settings_sender_email"
              aria-describedby="settings_sender_email_hint"
              name="sender_email"
              type="email"
              defaultValue={current.senderEmail}
              placeholder="hello@yourschool.org"
              className={inputCls}
              disabled={isPending}
            />
            <Hint id="settings_sender_email_hint">The address emails are sent from. Must be on your verified sending domain.</Hint>
          </div>

          <div>
            <Label htmlFor="settings_reply_to_email">Reply-To Email</Label>
            <input
              id="settings_reply_to_email"
              aria-describedby="settings_reply_to_email_hint"
              name="reply_to_email"
              type="email"
              defaultValue={current.replyToEmail}
              placeholder="office@yourschool.org"
              className={inputCls}
              disabled={isPending}
            />
            <Hint id="settings_reply_to_email_hint">When recipients hit "Reply," their message goes here. Leave blank to use the sending address.</Hint>
          </div>
        </div>
      </section>

      {/* Email Footer */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
          Email Footer
        </h2>
        <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
          <div>
            <Label htmlFor="settings_footer_text">Footer Text</Label>
            <textarea
              id="settings_footer_text"
              aria-describedby="settings_footer_text_hint"
              name="footer_text"
              rows={3}
              defaultValue={current.footerText}
              placeholder="123 Main Street · Springfield · (212) 555-0100"
              className={textareaCls}
              disabled={isPending}
            />
            <Hint id="settings_footer_text_hint">Appears at the bottom of every email. Use for your address, phone, or a short tagline.</Hint>
          </div>

          <div>
            <Label htmlFor="settings_website_url">Website URL</Label>
            <input
              id="settings_website_url"
              aria-describedby="settings_website_url_hint"
              name="website_url"
              type="url"
              defaultValue={current.websiteUrl}
              placeholder="https://yourschool.org"
              className={inputCls}
              disabled={isPending}
            />
            <Hint id="settings_website_url_hint">Displayed as a clickable link in the email footer.</Hint>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-[12px] font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
