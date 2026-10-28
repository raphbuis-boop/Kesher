"use client";

import { useState } from "react";
import { TIMEZONE_OPTIONS } from "@/lib/schoolTime";
import { saveMessagingSettings } from "../messagingActions";
import { Panel, Pill, FieldLabel, inputCls, useAction } from "./ui";

/** Settings → Messaging: school time zone, approvals, and whether scheduled sends are being picked up. */
export function MessagingSettings({
  timezone,
  requireApproval,
  hebrewDates,
  schedulerLastRun,
  schedulerHealthy,
  siteUrl,
}: {
  timezone: string;
  requireApproval: boolean;
  hebrewDates: string;
  schedulerLastRun: string | null;
  schedulerHealthy: boolean;
  siteUrl: string;
}) {
  const [tz, setTz] = useState(timezone);
  const [approval, setApproval] = useState(requireApproval);
  const [hebrew, setHebrew] = useState(hebrewDates);
  const { pending, run } = useAction();
  const known = TIMEZONE_OPTIONS.some((o) => o.value === tz);
  const dirty = tz !== timezone || approval !== requireApproval || hebrew !== hebrewDates;

  return (
    <div className="space-y-5">
      <Panel
        title="Scheduling and approvals"
        description="Scheduled and repeating messages are entered and shown in your school's time zone, whatever time zone the person scheduling them is in."
        footer={
          <button type="button" disabled={pending || !dirty} onClick={() => run(() => saveMessagingSettings({ timezone: tz, requireApproval: approval, hebrewDates: hebrew }), "Saved")} className="btn btn-primary">
            Save
          </button>
        }
      >
        <div className="space-y-5">
          <FieldLabel label="School time zone">
            <select value={tz} onChange={(e) => setTz(e.target.value)} className={inputCls}>
              {!known && <option value={tz}>{tz}</option>}
              {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldLabel>

          <FieldLabel label="Hebrew dates" hint="Shown next to dates on the dashboard, in your messages list and when you schedule. The Hebrew day really starts at sunset; this follows the regular calendar day.">
            <select value={hebrew} onChange={(e) => setHebrew(e.target.value)} className={inputCls}>
              <option value="latin">Show, in English letters (26 Cheshvan 5787)</option>
              <option value="hebrew">Show, in Hebrew letters (כ״ו בחשוון תשפ״ז)</option>
              <option value="off">Don&apos;t show</option>
            </select>
          </FieldLabel>

          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-[var(--ink)]" />
            <span>
              <span className="block text-[13px] font-medium text-ink">Members need an admin&apos;s approval to send</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-3">
                Members can still write and save drafts. When they send or schedule, it goes to Messages → Needs approval, where an owner or admin can approve, edit or send it back. Owners and admins always send directly. Off by default.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel
        title="Background sender"
        description="Scheduled and repeating messages go out from a small job that runs every few minutes. It also finishes any send that was interrupted."
      >
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-[12px] text-ink-2">
            {schedulerHealthy ? <Pill tone="ok">Running</Pill> : <Pill tone="warn">{schedulerLastRun ? "Not running" : "Not set up yet"}</Pill>}
            {schedulerLastRun ? <>Last checked in {new Date(schedulerLastRun).toLocaleString()}</> : "It hasn't checked in yet."}
          </p>
          {!schedulerHealthy && (
            <div className="rounded-lg border border-line bg-canvas px-4 py-3 text-[12px] leading-relaxed text-ink-2">
              <p className="font-medium text-ink">One-time setup (whoever hosts Kesher does this once)</p>
              <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                <li>Make sure the <code>CRON_SECRET</code> environment variable is set.</li>
                <li>
                  Vercel Pro: add <code>{`{ "path": "/api/cron/dispatch", "schedule": "*/5 * * * *" }`}</code> to <code>crons</code> in <code>vercel.json</code>. (Vercel&apos;s free plan only allows daily jobs and will reject the deploy.)
                </li>
                <li>
                  Any other plan: run <code>scripts/optional_pg_cron.sql</code> in Supabase, which calls <code>{siteUrl || "https://your-site"}/api/cron/dispatch</code> every 5 minutes.
                </li>
              </ol>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
