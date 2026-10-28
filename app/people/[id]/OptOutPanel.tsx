"use client";

import { useState, useTransition } from "react";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { restoreOptOut, stopMessaging } from "./optoutActions";

export type OptOutRow = {
  id: string;
  channel: "email" | "sms" | "whatsapp";
  address: string;
  reason: string;
  source: string | null;
  createdAt: string;
  releasedAt: string | null;
  releaseReason: string | null;
};

const CHANNEL = { email: "Email", sms: "Text", whatsapp: "WhatsApp" } as const;
const REASON: Record<string, string> = {
  stop: "Replied STOP",
  unsubscribe: "Unsubscribed from email",
  complaint: "Marked an email as spam",
  bounce: "Email address bounced",
  manual: "Stopped by staff",
};

export function OptOutPanel({ personId, rows, canManage, addable }: { personId: string; rows: OptOutRow[]; canManage: boolean; addable: ("email" | "sms" | "whatsapp")[] }) {
  const [pending, start] = useTransition();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const active = rows.filter((r) => !r.releasedAt);
  const past = rows.filter((r) => r.releasedAt);

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, done: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        done();
      } else toast.error(res.error);
    });

  return (
    <div className="space-y-4">
      {active.length === 0 ? (
        <p className="text-[12px] text-ink-3">No opt-outs. This person gets every message they&apos;re eligible for.</p>
      ) : (
        <ul className="divide-y divide-muted rounded-lg border border-line">
          {active.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{CHANNEL[r.channel]} <span className="font-mono text-[11px] font-normal text-ink-3">{r.address}</span></p>
                  <p className="text-[11px] text-rose-700">{REASON[r.reason] ?? r.reason} · {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                {canManage && restoring !== r.id && (
                  <button type="button" onClick={() => { setRestoring(r.id); setReason(""); }} className="btn btn-secondary btn-sm">Allow messages again</button>
                )}
              </div>
              {restoring === r.id && (
                <form
                  className="mt-3 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => restoreOptOut(personId, r.id, reason), () => setRestoring(null));
                  }}
                >
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (recorded)" autoFocus className="min-w-[220px] flex-1 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ink-3" />
                  <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? <Spinner size={10} /> : "Allow"}</button>
                  <button type="button" onClick={() => setRestoring(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <p className="w-full text-[11px] text-ink-3">Only do this if the parent asked to be added back. They can also reply START to a text.</p>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && addable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          Stop messaging on:
          {addable.map((c) => (
            <button key={c} type="button" disabled={pending} onClick={() => confirm(`Stop all ${CHANNEL[c].toLowerCase()} messages to this person?`) && run(() => stopMessaging(personId, c), () => undefined)} className="btn btn-ghost btn-sm">
              {CHANNEL[c]}
            </button>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <details className="text-[12px] text-ink-3">
          <summary className="cursor-pointer">History ({past.length})</summary>
          <ul className="mt-2 space-y-1">
            {past.map((r) => (
              <li key={r.id}>
                {CHANNEL[r.channel]} · {REASON[r.reason] ?? r.reason} {new Date(r.createdAt).toLocaleDateString()}, lifted {new Date(r.releasedAt!).toLocaleDateString()}{r.releaseReason ? ` (${r.releaseReason})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
