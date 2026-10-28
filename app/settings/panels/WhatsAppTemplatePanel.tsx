"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { WhatsAppLive } from "../channels";
import { Panel, Pill } from "./ui";

/** Exact text to submit to Meta (UTILITY category) — one template for every group. */
export const SUGGESTED_TEMPLATE = {
  name: "school_announcement",
  category: "UTILITY",
  body: "Update from {{1}}: {{2}}\n\nReply STOP to stop receiving these messages.",
  samples: ["Heichal HaTorah", "School is closed tomorrow due to snow. Stay safe!"],
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="btn btn-ghost btn-sm"
    >
      {done ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />} {label}
    </button>
  );
}

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "muted"> = {
  APPROVED: "ok",
  PENDING: "warn",
  IN_APPEAL: "warn",
  REJECTED: "bad",
  PAUSED: "bad",
  DISABLED: "bad",
  NOT_FOUND: "bad",
};

export function WhatsAppTemplatePanel({
  configured,
  templateName,
  templateVars,
  live,
  hasWaba,
}: {
  configured: boolean;
  templateName: string;
  templateVars: 1 | 2;
  live: WhatsAppLive | null;
  hasWaba: boolean;
}) {
  const t = live?.template;
  return (
    <Panel
      title="WhatsApp message template"
      description="WhatsApp only lets a school start a conversation with an approved template. Kesher uses a single UTILITY template for every group: the school or group name goes in the first variable and the message in the second."
    >
      {!configured ? (
        <p className="text-[12px] text-ink-3">Set up your WhatsApp number in the Channels tab first.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[12px] text-ink">{templateName}</span>
            {t ? (
              <>
                <Pill tone={STATUS_TONE[t.status] ?? "muted"}>{t.status === "NOT_FOUND" ? "Not found in Meta" : t.status.charAt(0) + t.status.slice(1).toLowerCase().replace(/_/g, " ")}</Pill>
                {t.category && <Pill tone={t.category === "UTILITY" ? "ok" : "warn"}>{t.category}</Pill>}
                <span className="text-[11px] text-ink-3">{t.language}</span>
              </>
            ) : (
              <Pill tone="muted">{hasWaba ? "Status unavailable" : "Add your WABA ID to see approval status"}</Pill>
            )}
          </div>
          {t?.bodyText && (
            <p className="whitespace-pre-line rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[11.5px] text-ink-soft">{t.bodyText}</p>
          )}
          {t?.variables !== null && t?.variables !== undefined && t.variables !== templateVars && (
            <p className="text-[12px] text-amber-700 [[data-theme=dark]_&]:text-amber-300">
              Meta&apos;s template has {t.variables} variable{t.variables === 1 ? "" : "s"} but Kesher is set to send {templateVars}. Change &quot;Variables&quot; in Channels to match, or sends will fail.
            </p>
          )}
          {t?.category && t.category !== "UTILITY" && (
            <p className="text-[12px] text-amber-700 [[data-theme=dark]_&]:text-amber-300">Only UTILITY templates reliably deliver to US numbers. Create a UTILITY one and point Kesher at it.</p>
          )}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
        <p className="text-[12px] font-semibold text-ink">Create this template in Meta (once)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-ink-2">
          <li>Meta Business Suite → WhatsApp Manager → Message templates → Create template.</li>
          <li>Category: <b>Utility</b>. Name: <span className="font-mono">{SUGGESTED_TEMPLATE.name}</span>. Language: English (US).</li>
          <li>Body:</li>
        </ol>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-card px-3 py-2 font-mono text-[12px] text-ink">{SUGGESTED_TEMPLATE.body}</pre>
        <p className="mt-2 text-[12px] text-ink-2">Sample values Meta asks for: <span className="font-mono">{SUGGESTED_TEMPLATE.samples[0]}</span> and <span className="font-mono">{SUGGESTED_TEMPLATE.samples[1]}</span>.</p>
        <div className="mt-2 flex gap-1">
          <CopyButton text={SUGGESTED_TEMPLATE.body} label="Copy body" />
          <CopyButton text={SUGGESTED_TEMPLATE.name} label="Copy name" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          After it&apos;s approved, enter the template name in Channels and set Variables to 2. Meta doesn&apos;t allow line breaks inside a variable, so paragraph breaks in your message are sent as &ldquo; | &rdquo;.
          Fundraising and donation wording is blocked on WhatsApp.
        </p>
      </div>
    </Panel>
  );
}
