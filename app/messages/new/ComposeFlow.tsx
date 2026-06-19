"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, type Channel } from "../actions";

export type AudienceOption = {
  slug: string;
  label: string;
  totalCount: number;
  emailCount: number;
  phoneCount: number;
};

type Step = "audience" | "compose" | "preview";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function combinedCount(audiences: AudienceOption[], channel: Channel): number {
  if (channel === "email") return audiences.reduce((s, a) => s + a.emailCount, 0);
  return audiences.reduce((s, a) => s + a.phoneCount, 0);
}

function channelLabel(channel: Channel): string {
  return channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp";
}

function channelField(channel: Channel): string {
  return channel === "email" ? "email" : "phone number";
}

function audienceSummary(audiences: AudienceOption[]): string {
  if (audiences.length === 0) return "";
  if (audiences.length === 1) return audiences[0].label;
  if (audiences.length === 2) return `${audiences[0].label} & ${audiences[1].label}`;
  return `${audiences[0].label} +${audiences.length - 1} more`;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "audience", label: "Audience" },
    { key: "compose", label: "Compose" },
    { key: "preview", label: "Preview" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
              (i <= currentIndex ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400")
            }
          >
            {i < currentIndex ? (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : i + 1}
          </div>
          <span className={"text-sm " + (i === currentIndex ? "font-medium text-zinc-900" : "text-zinc-400")}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="mx-1 text-zinc-200">→</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Audience step (multi-select) ─────────────────────────────────────────────

function AudienceStep({
  audiences,
  selected,
  onToggle,
  onContinue,
}: {
  audiences: AudienceOption[];
  selected: AudienceOption[];
  onToggle: (a: AudienceOption) => void;
  onContinue: () => void;
}) {
  const systemSlugs = ["parents","students","grandparents","alumni","faculty","staff","board","donors","prospects"];
  const systemAudiences = audiences.filter((a) => systemSlugs.includes(a.slug));
  const customAudiences = audiences.filter((a) => !systemSlugs.includes(a.slug));
  const selectedSlugs = new Set(selected.map((a) => a.slug));
  const totalSelected = selected.reduce((s, a) => s + a.totalCount, 0);

  function Card({ audience }: { audience: AudienceOption }) {
    const isSelected = selectedSlugs.has(audience.slug);
    return (
      <button
        onClick={() => onToggle(audience)}
        className={
          "group relative flex flex-col items-start rounded-xl border p-5 text-left transition-all focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 " +
          (isSelected
            ? "border-zinc-900 bg-zinc-900"
            : "border-zinc-200 bg-white hover:border-zinc-400 hover:shadow-sm")
        }
      >
        {/* Checkmark */}
        <div
          className={
            "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border transition-all " +
            (isSelected
              ? "border-white bg-white"
              : "border-zinc-200 bg-transparent group-hover:border-zinc-400")
          }
        >
          {isSelected && (
            <svg className="h-3 w-3 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </div>

        <span className={"mb-3 text-sm font-semibold " + (isSelected ? "text-white" : "text-zinc-900")}>
          {audience.label}
        </span>
        <span className={"text-2xl font-bold tabular-nums " + (audience.totalCount === 0 ? (isSelected ? "text-zinc-500" : "text-zinc-300") : (isSelected ? "text-white" : "text-zinc-900"))}>
          {audience.totalCount.toLocaleString()}
        </span>
        <span className={"mt-0.5 text-xs " + (isSelected ? "text-zinc-400" : "text-zinc-400")}>contacts</span>
      </button>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900">Choose audiences</h2>
        <p className="mt-0.5 text-sm text-zinc-500">Select one or more audiences to receive this message.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {systemAudiences.map((a) => <Card key={a.slug} audience={a} />)}
      </div>

      {customAudiences.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Custom Audiences</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {customAudiences.map((a) => <Card key={a.slug} audience={a} />)}
          </div>
        </div>
      )}

      {/* Sticky continue bar */}
      <div
        className={
          "mt-8 flex items-center justify-between rounded-xl border p-4 transition-all " +
          (selected.length > 0
            ? "border-zinc-200 bg-white shadow-sm"
            : "border-zinc-100 bg-zinc-50")
        }
      >
        <div className="text-sm text-zinc-500">
          {selected.length === 0 ? (
            "No audiences selected"
          ) : (
            <>
              <span className="font-medium text-zinc-900">
                {selected.map((a) => a.label).join(", ")}
              </span>
              <span className="ml-2 text-zinc-400">· {totalSelected.toLocaleString()} contacts</span>
            </>
          )}
        </div>
        <button
          onClick={onContinue}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Continue
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Channel selector ─────────────────────────────────────────────────────────

function ChannelSelector({
  channel,
  audiences,
  onChange,
}: {
  channel: Channel;
  audiences: AudienceOption[];
  onChange: (c: Channel) => void;
}) {
  const emailCount = audiences.reduce((s, a) => s + a.emailCount, 0);
  const phoneCount = audiences.reduce((s, a) => s + a.phoneCount, 0);

  const options: { value: Channel; label: string; count: number; icon: React.ReactNode }[] = [
    {
      value: "email",
      label: "Email",
      count: emailCount,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      ),
    },
    {
      value: "sms",
      label: "SMS",
      count: phoneCount,
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 15h3" />
        </svg>
      ),
    },
    {
      value: "whatsapp",
      label: "WhatsApp",
      count: phoneCount,
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-medium text-zinc-500">Channel</p>
      <div className="flex gap-2">
        {options.map((opt) => {
          const selected = channel === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={
                "flex flex-1 flex-col items-center gap-1 rounded-lg border py-3 text-xs font-medium transition-colors " +
                (selected
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-700")
              }
            >
              <span className={selected ? "text-white" : "text-zinc-400"}>{opt.icon}</span>
              <span>{opt.label}</span>
              <span className={"text-[10px] tabular-nums " + (selected ? "text-zinc-300" : "text-zinc-400")}>
                {opt.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Compose step ─────────────────────────────────────────────────────────────

const SMS_LIMIT = 160;

function ComposeStep({
  audiences,
  channel,
  subject,
  body,
  onChannelChange,
  onSubjectChange,
  onBodyChange,
  onBack,
  onPreview,
}: {
  audiences: AudienceOption[];
  channel: Channel;
  subject: string;
  body: string;
  onChannelChange: (c: Channel) => void;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onBack: () => void;
  onPreview: () => void;
}) {
  const recipientCount = combinedCount(audiences, channel);
  const totalCount = audiences.reduce((s, a) => s + a.totalCount, 0);
  const missing = totalCount - recipientCount;
  const canPreview =
    (channel !== "email" || subject.trim().length > 0) &&
    body.trim().length > 0 &&
    recipientCount > 0;

  return (
    <div>
      {/* Header row */}
      <div className="mb-6 flex items-center gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="flex flex-wrap gap-1.5">
          {audiences.map((a) => (
            <span
              key={a.slug}
              className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {a.label}
            </span>
          ))}
        </div>
        <span className="text-sm text-zinc-400">
          {recipientCount.toLocaleString()} recipients
          {missing > 0 && <span className="text-zinc-300"> · {missing} without {channelField(channel)}</span>}
        </span>
      </div>

      {/* Channel selector */}
      <ChannelSelector channel={channel} audiences={audiences} onChange={(c) => { onChannelChange(c); if (c !== "email") onSubjectChange(""); }} />

      {recipientCount === 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          No contacts in the selected audiences have a {channelField(channel)}. Choose a different channel.
        </div>
      )}

      <div className="space-y-4">
        {channel === "email" && (
          <div>
            <label htmlFor="compose_subject" className="mb-1 block text-xs font-medium text-zinc-500">
              Subject
            </label>
            <input
              id="compose_subject"
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder="Enter subject line…"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400"
              autoFocus
            />
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="compose_body" className="block text-xs font-medium text-zinc-500">
              Message
            </label>
            {channel === "sms" && (
              <span className={"text-xs tabular-nums " + (body.length > SMS_LIMIT ? "font-medium text-red-500" : "text-zinc-400")}>
                {body.length} / {SMS_LIMIT}
              </span>
            )}
          </div>
          <textarea
            id="compose_body"
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder={
              channel === "email"
                ? "Write your message here…\n\nSeparate paragraphs with a blank line."
                : channel === "sms"
                ? "Write your SMS message…"
                : "Write your WhatsApp message…"
            }
            rows={channel === "email" ? 16 : 8}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-400"
            autoFocus={channel !== "email"}
          />
          {channel === "email" && (
            <p className="mt-1 text-xs text-zinc-400">Separate paragraphs with a blank line.</p>
          )}
          {channel === "sms" && body.length > SMS_LIMIT && (
            <p className="mt-1 text-xs text-amber-600">
              Over 160 characters — will be sent as {Math.ceil(body.length / SMS_LIMIT)} segments.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onPreview}
            disabled={!canPreview}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Preview
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview step ─────────────────────────────────────────────────────────────

function EmailPreview({ body }: { body: string }) {
  const paragraphs = body.split(/\n\n+/).filter((p) => p.trim());
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="mx-auto max-w-[560px] rounded-xl border border-zinc-200 bg-white px-10 py-8 shadow-sm">
        {paragraphs.map((para, i) => (
          <p key={i} className="mb-4 text-sm leading-relaxed text-zinc-800 last:mb-0">
            {para.split("\n").map((line, j, arr) => (
              <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}

function SmsPreview({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-6">
      <div className="mx-auto max-w-[280px]">
        <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-zinc-300 px-4 py-2.5 text-sm leading-relaxed text-zinc-900">
          {body}
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreview({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-[#e5ddd5] p-6">
      <div className="mx-auto max-w-[280px]">
        <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-zinc-900 shadow-sm">
          {body}
          <span className="ml-2 text-[10px] text-zinc-400">✓✓</span>
        </div>
      </div>
    </div>
  );
}

function PreviewStep({
  audiences,
  channel,
  subject,
  body,
  fromEmail,
  onBack,
  onSend,
  isSending,
  sendError,
}: {
  audiences: AudienceOption[];
  channel: Channel;
  subject: string;
  body: string;
  fromEmail: string;
  onBack: () => void;
  onSend: () => void;
  isSending: boolean;
  sendError: string | null;
}) {
  const recipientCount = combinedCount(audiences, channel);
  const totalCount = audiences.reduce((s, a) => s + a.totalCount, 0);

  return (
    <div>
      {/* Summary card */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="space-y-2.5">
          <div className="flex items-start gap-3">
            <span className="w-16 flex-shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-zinc-400">To</span>
            <div className="flex flex-wrap gap-1.5">
              {audiences.map((a) => (
                <span key={a.slug} className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {a.label}
                </span>
              ))}
              <span className="text-sm text-zinc-500">
                {recipientCount.toLocaleString()} recipient{recipientCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="w-16 flex-shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">Via</span>
            <span className="text-sm font-medium text-zinc-800">{channelLabel(channel)}</span>
          </div>
          {channel === "email" && fromEmail && (
            <div className="flex items-baseline gap-3">
              <span className="w-16 flex-shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">From</span>
              <span className="text-sm text-zinc-600">{fromEmail}</span>
            </div>
          )}
          {channel === "email" && (
            <div className="flex items-baseline gap-3">
              <span className="w-16 flex-shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">Subject</span>
              <span className="text-sm font-medium text-zinc-900">{subject}</span>
            </div>
          )}
        </div>
      </div>

      {/* Message preview */}
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Preview</p>
        {channel === "email" && <EmailPreview body={body} />}
        {channel === "sms" && <SmsPreview body={body} />}
        {channel === "whatsapp" && <WhatsAppPreview body={body} />}
      </div>

      {/* Mock notice for SMS/WhatsApp */}
      {(channel === "sms" || channel === "whatsapp") && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-500">
          <span className="font-medium text-zinc-700">{channelLabel(channel)} is in preview mode.</span>{" "}
          Messages will be recorded but not delivered until a provider is connected.
        </div>
      )}

      {/* Missing recipients warning */}
      {recipientCount < totalCount && recipientCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          {(totalCount - recipientCount).toLocaleString()} contact{totalCount - recipientCount !== 1 ? "s" : ""} don&apos;t have a {channelField(channel)} and will not receive this message.
        </div>
      )}

      {recipientCount === 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          No contacts in the selected audiences have a {channelField(channel)}.
        </div>
      )}

      {sendError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sendError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={isSending}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Edit message
        </button>

        <button
          onClick={onSend}
          disabled={isSending || recipientCount === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Sending…
            </>
          ) : (
            `Send ${channelLabel(channel)} to ${recipientCount.toLocaleString()} contact${recipientCount !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function ComposeFlow({
  audiences,
  fromEmail,
}: {
  audiences: AudienceOption[];
  fromEmail: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("audience");
  const [selectedAudiences, setSelectedAudiences] = useState<AudienceOption[]>([]);
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  function toggleAudience(audience: AudienceOption) {
    setSelectedAudiences((prev) =>
      prev.some((a) => a.slug === audience.slug)
        ? prev.filter((a) => a.slug !== audience.slug)
        : [...prev, audience]
    );
  }

  function handleSend() {
    if (selectedAudiences.length === 0) return;
    setSendError(null);
    startTransition(async () => {
      const label = audienceSummary(selectedAudiences);
      const result = await sendMessage(
        selectedAudiences.map((a) => a.slug),
        label,
        channel,
        subject,
        body
      );
      if (result.success) {
        router.push("/messages");
        router.refresh();
      } else {
        setSendError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div>
      <div className="mb-8">
        <StepIndicator step={step} />
      </div>

      {step === "audience" && (
        <AudienceStep
          audiences={audiences}
          selected={selectedAudiences}
          onToggle={toggleAudience}
          onContinue={() => setStep("compose")}
        />
      )}

      {step === "compose" && selectedAudiences.length > 0 && (
        <ComposeStep
          audiences={selectedAudiences}
          channel={channel}
          subject={subject}
          body={body}
          onChannelChange={setChannel}
          onSubjectChange={setSubject}
          onBodyChange={setBody}
          onBack={() => setStep("audience")}
          onPreview={() => setStep("preview")}
        />
      )}

      {step === "preview" && selectedAudiences.length > 0 && (
        <PreviewStep
          audiences={selectedAudiences}
          channel={channel}
          subject={subject}
          body={body}
          fromEmail={fromEmail}
          onBack={() => setStep("compose")}
          onSend={handleSend}
          isSending={isPending}
          sendError={sendError}
        />
      )}
    </div>
  );
}
