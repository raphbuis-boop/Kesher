"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageSquare, RefreshCw, Smartphone } from "lucide-react";
import { Spinner } from "@/app/components/ui/Spinner";
import { toast } from "@/app/components/ui/toast";
import type { ChannelStatus, ChannelsOverview } from "../channels";
import { checkWhatsAppNow, removeWhatsAppToken, saveSms, saveWhatsApp } from "../channelActions";
import { FieldLabel, Panel, Pill, inputCls, useAction } from "./ui";

const ICONS = { email: Mail, sms: Smartphone, whatsapp: MessageSquare } as const;

function StatePill({ s }: { s: ChannelStatus }) {
  return s.state === "connected" ? <Pill tone="ok">Connected</Pill> : s.state === "attention" ? <Pill tone="warn">Needs attention</Pill> : <Pill tone="muted">Not connected</Pill>;
}

export function ChannelsSettings({ overview, simulated }: { overview: ChannelsOverview; simulated: boolean }) {
  const router = useRouter();
  const { form } = overview;
  const [wa, setWa] = useState({ ...form.whatsapp, accessToken: "" });
  const [sms, setSms] = useState(form.smsSender);
  const { pending, run } = useAction();
  const [checking, setChecking] = useState(false);

  return (
    <div className="space-y-5">
      {simulated && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 [[data-theme=dark]_&]:text-amber-300">
          Sends are simulated for this workspace (demo mode) — no real messages go out.
        </div>
      )}

      <Panel title="Status" description="Each channel and whether this school can send on it right now.">
        <ul className="divide-y divide-line">
          {overview.statuses.map((c) => {
            const Icon = ICONS[c.key];
            return (
              <li key={c.key} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <Icon size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{c.label}</p>
                    {c.detail.length > 0 && (
                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                        {c.detail.map((d) => (
                          <div key={d.label} className="contents">
                            <dt className="text-ink-3">{d.label}</dt>
                            <dd className="truncate font-mono text-[11.5px] text-ink-soft">{d.value || "—"}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {c.problem && <p className={`mt-1 text-[12px] ${c.state === "attention" ? "text-amber-700 [[data-theme=dark]_&]:text-amber-300" : "text-ink-3"}`}>{c.problem}</p>}
                  </div>
                </div>
                <StatePill s={c} />
              </li>
            );
          })}
        </ul>
        {form.usesPlatformDefaults && (
          <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
            This school is still using Kesher&apos;s shared WhatsApp/SMS settings for anything left blank below. Fill in your own and they take over.
          </p>
        )}
      </Panel>

      <Panel
        title="WhatsApp"
        description={
          <>
            Your school&apos;s own WhatsApp Business number (Meta Cloud API). Kesher sends every group through <b>one approved UTILITY template</b> — not one per group — so you only
            set it up once. See Templates for the exact text to submit.
          </>
        }
        footer={
          <>
            <button
              type="button"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                const res = await checkWhatsAppNow();
                setChecking(false);
                if (res.ok) {
                  toast.success(res.live.error ? res.live.error : "Checked with Meta");
                  router.refresh();
                } else toast.error(res.error);
              }}
              className="btn btn-secondary"
            >
              {checking ? <Spinner /> : <RefreshCw size={12} />} Check with Meta
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  async () => {
                    const r = await saveWhatsApp(wa);
                    return r;
                  },
                  "WhatsApp settings saved",
                  () => {
                    setWa((w) => ({ ...w, accessToken: "" }));
                    router.refresh();
                  }
                )
              }
              className="btn btn-primary"
            >
              {pending && <Spinner />} Save WhatsApp
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldLabel label="Phone number ID" hint="Meta → WhatsApp → API setup.">
            <input value={wa.phoneNumberId} onChange={(e) => setWa({ ...wa, phoneNumberId: e.target.value })} className={`${inputCls} font-mono`} inputMode="numeric" />
          </FieldLabel>
          <FieldLabel label="WhatsApp Business Account (WABA) ID" hint="Lets Kesher show whether your template is approved.">
            <input value={wa.wabaId} onChange={(e) => setWa({ ...wa, wabaId: e.target.value })} className={`${inputCls} font-mono`} inputMode="numeric" />
          </FieldLabel>
          <FieldLabel label="Display name" hint="Just for your reference here.">
            <input value={wa.displayName} onChange={(e) => setWa({ ...wa, displayName: e.target.value })} className={inputCls} maxLength={100} />
          </FieldLabel>
          <FieldLabel label="Access token" hint={wa.hasOwnToken ? "A token is saved (stored encrypted, never shown). Paste a new one to replace it." : "A permanent System User token. Stored encrypted; never shown again."}>
            <input value={wa.accessToken} onChange={(e) => setWa({ ...wa, accessToken: e.target.value })} type="password" autoComplete="off" placeholder={wa.hasOwnToken ? "••••••••••••••••" : "EAAG…"} className={`${inputCls} font-mono`} />
          </FieldLabel>
          <FieldLabel label="Template name">
            <input value={wa.templateName} onChange={(e) => setWa({ ...wa, templateName: e.target.value })} className={`${inputCls} font-mono`} placeholder="school_announcement" />
          </FieldLabel>
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Language">
              <input value={wa.templateLang} onChange={(e) => setWa({ ...wa, templateLang: e.target.value })} className={`${inputCls} font-mono`} placeholder="en_US" />
            </FieldLabel>
            <FieldLabel label="Variables">
              <select value={wa.templateVars} onChange={(e) => setWa({ ...wa, templateVars: Number(e.target.value) as 1 | 2 })} className={inputCls}>
                <option value={1}>1 — message</option>
                <option value={2}>2 — school/group + message</option>
              </select>
            </FieldLabel>
          </div>
        </div>
        {wa.hasOwnToken && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Remove the saved access token? WhatsApp sending stops until you add one.")) run(async () => removeWhatsAppToken(), "Access token removed", () => router.refresh());
            }}
            className="btn btn-ghost btn-sm mt-3"
          >
            Remove saved token
          </button>
        )}
      </Panel>

      <Panel
        title="SMS"
        description="The number your texts come from. It must be registered for A2P 10DLC with your SMS provider (Sinch) before US carriers will deliver."
        footer={
          <button type="button" disabled={pending} onClick={() => run(async () => saveSms(sms), "SMS sender saved", () => router.refresh())} className="btn btn-primary">
            {pending && <Spinner />} Save SMS sender
          </button>
        }
      >
        <FieldLabel label="Sender number" hint="Full number with country code, like +12125551234.">
          <input value={sms} onChange={(e) => setSms(e.target.value)} className={`${inputCls} max-w-xs font-mono`} placeholder="+12125551234" inputMode="tel" />
        </FieldLabel>
      </Panel>
    </div>
  );
}
