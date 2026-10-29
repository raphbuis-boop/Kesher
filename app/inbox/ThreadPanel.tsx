"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, MessageSquare, RotateCcw, Smartphone, User } from "lucide-react";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { assignThread, markThreadRead, replyToThread, setThreadDone } from "./actions";

export type Teammate = { id: string; name: string };

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "whatsapp";
  body: string;
  status: string | null;
  kind: "message" | "optout" | "optin";
  at: string;
  atLabel: string;
  repliedTo: { id: string; title: string; sentAt: string | null } | null;
  error: string | null;
  sender: string | null;
};

export type ThreadView = {
  id: string;
  name: string;
  personId: string | null;
  address: string | null;
  status: "open" | "done";
  assignedTo: string | null;
  unread: number;
  lastChannel: "sms" | "whatsapp";
  canSms: boolean;
  canWhatsapp: boolean;
  whatsappOpen: boolean;
  whatsappUntil: string | null;
  teammates: Teammate[];
  messages: ThreadMessage[];
};

export function ThreadPanel({ view, currentUserId, backHref }: { view: ThreadView; currentUserId: string; backHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">(view.lastChannel === "whatsapp" && view.canWhatsapp ? "whatsapp" : view.canSms ? "sms" : "whatsapp");
  const [templateNeeded, setTemplateNeeded] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // Opening a conversation reads it
  useEffect(() => {
    if (view.unread > 0) markThreadRead(view.id).then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [view.messages.length]);

  const waClosed = channel === "whatsapp" && !view.whatsappOpen;

  const send = (asTemplate: boolean) =>
    start(async () => {
      const res = await replyToThread(view.id, body, channel, asTemplate);
      if (res.ok) {
        setBody("");
        setTemplateNeeded(false);
        toast.success(res.usedTemplate ? "Sent as a WhatsApp template message" : "Sent");
        router.refresh();
      } else if (res.code === "window_closed") setTemplateNeeded(true);
      else toast.error(res.error);
    });

  const act = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else toast.error(res.error);
    });

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[420px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={backHref} className="md:hidden text-ink-3" aria-label="Back to the list"><ArrowLeft size={16} /></Link>
          <div className="min-w-0">
            <p dir="auto" className="truncate text-[14px] font-semibold text-ink">{view.name}</p>
            <p className="font-mono text-[11px] text-ink-3">{view.address}</p>
          </div>
          {view.personId && <Link href={`/people/${view.personId}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink-2"><User size={11} /> Profile</Link>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Assign to"
            value={view.assignedTo ?? ""}
            disabled={pending}
            onChange={(e) => act(() => assignThread(view.id, e.target.value || null))}
            className="rounded-md border border-line bg-card py-1.5 pl-2.5 pr-7 text-xs font-medium text-ink-soft outline-none"
          >
            <option value="">Unassigned</option>
            {view.teammates.map((t) => <option key={t.id} value={t.id}>{t.id === currentUserId ? "Me" : t.name}</option>)}
          </select>
          <button type="button" disabled={pending} onClick={() => act(() => setThreadDone(view.id, view.status !== "done"))} className="btn btn-secondary btn-sm">
            {view.status === "done" ? <><RotateCcw size={11} /> Reopen</> : <><Check size={11} /> Mark done</>}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-canvas px-5 py-4">
        {view.messages.map((m) => {
          if (m.kind !== "message") {
            return (
              <p key={m.id} className="text-center text-[11px] text-ink-3">
                {m.kind === "optout" ? "Replied STOP and was opted out" : "Replied START and was resubscribed"} · {m.atLabel}
              </p>
            );
          }
          const mine = m.direction === "outbound";
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              {m.repliedTo && (
                <Link href={`/messages/${m.repliedTo.id}`} dir="auto" className="mb-1 max-w-[80%] truncate rounded-md border-l-2 border-line-strong bg-muted px-2 py-1 text-[11px] text-ink-3 hover:text-ink-2">
                  In reply to: {m.repliedTo.title}
                </Link>
              )}
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${mine ? "rounded-br-sm bg-ink text-on-ink" : "rounded-bl-sm border border-line bg-card text-ink"}`}>
                <div dir="auto">{m.body}</div>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-3">
                {m.channel === "whatsapp" ? <MessageSquare size={10} className="text-emerald-500" /> : <Smartphone size={10} className="text-blue-500" />}
                {mine && m.sender ? `${m.sender} · ` : ""}{m.atLabel}
                {mine && m.status && m.status !== "sent" ? ` · ${m.status}` : ""}
              </p>
              {m.error && <p className="max-w-[80%] text-[11px] text-red-600">{m.error}</p>}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="border-t border-line bg-card px-5 py-3">
        {view.canSms && view.canWhatsapp && (
          <div className="mb-2 flex items-center gap-2 text-[11px]">
            <span className="text-ink-3">Reply by</span>
            {(["sms", "whatsapp"] as const).map((c) => (
              <button key={c} type="button" onClick={() => { setChannel(c); setTemplateNeeded(false); }} className={`rounded-md px-2 py-1 font-medium ${channel === c ? "bg-ink text-on-ink" : "bg-muted text-ink-2"}`}>
                {c === "sms" ? "Text" : "WhatsApp"}
              </button>
            ))}
          </div>
        )}
        {channel === "whatsapp" && view.whatsappOpen && view.whatsappUntil && <p className="mb-2 text-[11px] text-ink-3">You can reply freely on WhatsApp until {view.whatsappUntil}.</p>}
        {(waClosed || templateNeeded) && (
          <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
            It&apos;s been more than 24 hours since they last wrote on WhatsApp, so WhatsApp only lets you start again with an approved template message.
            You can still send this as a template (it goes out in your school&apos;s approved format), or reply by text instead.
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            dir="auto"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Write a reply…"
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim() && !pending) send(waClosed);
            }}
          />
          <button type="button" disabled={pending || !body.trim()} onClick={() => send(waClosed)} className="btn btn-primary">
            {pending ? <Spinner size={12} /> : waClosed ? "Send as template" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
