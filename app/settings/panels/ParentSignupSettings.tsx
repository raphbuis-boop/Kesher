"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "@/app/components/ui/toast";
import { Panel, Pill, FieldLabel, inputCls, useAction } from "./ui";
import { resetSignupLink, saveSignupSettings } from "../signupActions";

export function ParentSignupSettings({
  enabled,
  intro,
  url,
  qrSvg,
  qrPng,
  pending,
  verifiesPhones,
}: {
  enabled: boolean;
  intro: string;
  url: string | null;
  qrSvg: string | null;
  qrPng: string | null;
  pending: number;
  verifiesPhones: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [text, setText] = useState(intro);
  const { pending: busy, run } = useAction();
  const dirty = on !== enabled || text !== intro;

  return (
    <div className="space-y-5">
      <Panel
        title="Parent signup"
        description="Put a link or QR code on a flyer, your website or a back-to-school email. Parents add themselves and their children, verify their phone, and agree to receive messages. Every signup waits for your approval before anyone is messaged."
        footer={
          <button type="button" disabled={busy || !dirty} onClick={() => run(() => saveSignupSettings({ enabled: on, intro: text }), "Saved")} className="btn btn-primary">
            Save
          </button>
        }
      >
        <div className="space-y-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--ink)]" />
            <span>
              <span className="block text-[13px] font-medium text-ink">Let parents sign themselves up</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-3">Turn this off to close signup at any time. The link stops working immediately.</span>
            </span>
          </label>
          <FieldLabel label="Message shown above the form (optional)" hint="For example: Welcome to the 5787 school year! Sign up to get news, closures and reminders.">
            <textarea dir="auto" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} className={`${inputCls} resize-none`} />
          </FieldLabel>
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-ink-2">
            Phone check:{" "}
            {verifiesPhones ? <Pill tone="ok">Parents verify their number with a text code</Pill> : <Pill tone="warn">Off: text messages aren&apos;t set up yet</Pill>}
            {!verifiesPhones && <Link href="/settings#channels" className="underline">Set up texting</Link>}
          </p>
        </div>
      </Panel>

      {enabled && (
        <Panel
          title="Your signup link and QR code"
          description="Print the QR code or share the link. Resetting creates a new link and the old one stops working."
          footer={
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm("Create a new link? Anything printed with the old link or QR code will stop working.") && run(() => resetSignupLink(), "New link created")}
              className="btn btn-secondary"
            >
              Reset link
            </button>
          }
        >
          {!url ? (
            <p className="text-[12px] text-red-600">The link can&apos;t be created yet: the server needs NEXT_PUBLIC_SITE_URL and a signing key (KESHER_LINK_SECRET).</p>
          ) : (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {qrSvg && <div className="h-44 w-44 shrink-0 rounded-lg border border-line bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className={`${inputCls} font-mono text-[11px]`} />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"), () => toast.error("Couldn't copy"))}
                    className="btn btn-secondary shrink-0"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
                {qrPng && (
                  <a href={qrPng} download="signup-qr-code.png" className="btn btn-secondary inline-flex">
                    <Download size={12} /> Download QR code (PNG)
                  </a>
                )}
                {pending > 0 && (
                  <Link href="/people/review" className="block text-[12px] font-medium text-brand hover:underline">
                    {pending} {pending === 1 ? "signup is" : "signups are"} waiting for review →
                  </Link>
                )}
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
