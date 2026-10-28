"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import type { Channel } from "@/lib/send/types";
import { previewResend, sendResend, type ResendPreview } from "../resendActions";

const LABELS: Record<Channel, string> = { email: "Email", sms: "Text", whatsapp: "WhatsApp" };

/** "Remind people who haven't confirmed or read it", with a choice of channel. Email opens are never used. */
export function ResendUnread({ messageId, unseenCount, originalChannels }: { messageId: string; unseenCount: number; originalChannels: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>(originalChannels.includes("sms") ? ["email"] : ["sms"]);
  const [preview, setPreview] = useState<ResendPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, startSend] = useTransition();

  useEffect(() => {
    if (!open || channels.length === 0) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await previewResend(messageId, channels);
      if (!cancelled) {
        setPreview(res);
        setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, channels, messageId]);

  const toggle = (c: Channel) => setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const ok = preview && preview.ok ? preview : null;
  const blocked = !ok || loading || channels.length === 0 || ok.reachable === 0 || ok.problems.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:border-line-strong hover:bg-canvas hover:text-ink"
      >
        <BellRing size={11} strokeWidth={2} />
        Remind people who haven&apos;t read it
      </button>

      {open && (
        <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="remind-title" className="animate-pop-in w-full max-w-md rounded-xl border border-line bg-card shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-muted px-5 py-4">
              <h2 id="remind-title" className="text-sm font-semibold text-ink">Send a reminder</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                Goes to people who haven&apos;t tapped &ldquo;I&apos;ve read this&rdquo; and haven&apos;t read it on WhatsApp ({unseenCount.toLocaleString()} {unseenCount === 1 ? "person" : "people"}).
                Email opens aren&apos;t counted, because they can be automatic.
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Send it by</p>
                <div className="flex flex-wrap gap-2">
                  {(["email", "sms", "whatsapp"] as Channel[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={channels.includes(c)}
                      onClick={() => toggle(c)}
                      className={"rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " + (channels.includes(c) ? "border-ink bg-ink text-on-ink" : "border-line text-ink-2 hover:border-line-strong")}
                    >
                      {LABELS[c]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-3">A different channel from the original often works better.</p>
              </div>

              <div className="min-h-[44px] text-sm text-ink-2">
                {loading || !preview ? (
                  <span className="inline-flex items-center gap-2"><Spinner size={12} /> Working out who this reaches…</span>
                ) : !preview.ok ? (
                  <span className="text-red-600">{preview.error}</span>
                ) : preview.unseen === 0 ? (
                  "Everyone has already confirmed or read this."
                ) : (
                  <div className="space-y-1">
                    <p>
                      <span className="font-medium text-ink">{preview.reachable.toLocaleString()} {preview.reachable === 1 ? "person" : "people"}</span> will get a reminder
                      {preview.reachable < preview.unseen && <span className="text-ink-3"> ({(preview.unseen - preview.reachable).toLocaleString()} can&apos;t be reached on {channels.length === 1 ? "this channel" : "these channels"} or opted out)</span>}
                    </p>
                    {preview.problems.map((p) => <p key={p} className="text-xs text-red-600">{p}</p>)}
                    {preview.notes.map((n) => <p key={n} className="text-xs text-ink-3">{n}</p>)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-muted px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:bg-canvas">Cancel</button>
              <button
                type="button"
                disabled={blocked || sending}
                onClick={() =>
                  startSend(async () => {
                    const res = await sendResend(messageId, channels);
                    if (res.success) {
                      toast.success(res.kind === "pending_approval" ? "Sent to an admin for approval" : "Reminder sent");
                      setOpen(false);
                      if ("messageId" in res) router.push(res.kind === "pending_approval" ? "/messages?tab=approval" : `/messages/${res.messageId}`);
                    } else toast.error(res.error);
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-on-ink hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? <Spinner size={12} /> : null}
                Send reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
