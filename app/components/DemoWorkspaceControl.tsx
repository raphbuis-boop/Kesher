"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, Loader2, CheckCircle2, X } from "lucide-react";
import { loadDemoDataAction, removeDemoDataAction } from "@/app/dashboard/demoActions";

type Phase = "idle" | "confirming" | "done";

/**
 * - "load":   empty-workspace card on the Overview page.
 * - "remove": destructive control, shown only on Settings.
 * - "badge":  passive page-header indicator that links to Settings, so the
 *             destructive action doesn't compete with each page's primary CTA.
 */
export function DemoWorkspaceControl({ mode }: { mode: "load" | "remove" | "badge" }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const res = mode === "load" ? await loadDemoDataAction() : await removeDemoDataAction();
      if (!res.success) {
        setError(res.error);
        setPhase("idle");
        return;
      }
      setMessage(res.message);
      setPhase("done");
      router.refresh();
    });
  }

  if (mode === "badge") {
    return (
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 rounded-full border border-warning-border bg-warning-tint px-2.5 py-1 text-[11px] font-medium text-warning hover:border-warning-solid"
      >
        Sample data
        <span className="sr-only">: Riverside Academy demo. Manage in Settings</span>
      </Link>
    );
  }

  if (mode === "load") {
    if (phase === "done") {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-success-border bg-success-tint px-3.5 py-2.5 text-[12px] text-success">
          <CheckCircle2 size={14} strokeWidth={2} className="shrink-0" />
          {message}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        {phase === "idle" ? (
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-tint border border-success-border">
              <Sparkles size={16} className="text-success" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary">Your workspace is empty</p>
              <p className="mt-1 text-[12px] text-text-muted leading-relaxed">
                Load a fictional demo school — sample contacts, audiences, and message history — to explore
                Kesher or prepare a product demo. Fully reversible.
              </p>
              <button
                type="button"
                onClick={() => setPhase("confirming")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:bg-primary-hover transition-colors"
              >
                <Sparkles size={12} strokeWidth={2} />
                Load demo workspace
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[13px] font-semibold text-text-primary">Load demo workspace?</p>
            <p className="mt-1 text-[12px] text-text-muted leading-relaxed">
              This adds a fictional school (&quot;Riverside Academy&quot;) with sample staff, families, audiences, and
              message history to this workspace only. No real emails, texts, or WhatsApp messages are sent —
              every contact uses fictional, non-deliverable details. You can remove it at any time.
            </p>
            {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60 transition-colors"
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2} />}
                {isPending ? "Loading…" : "Yes, load demo data"}
              </button>
              <button
                type="button"
                onClick={() => setPhase("idle")}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-muted hover:text-text-primary disabled:opacity-60 transition-colors"
              >
                <X size={12} strokeWidth={2} />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // mode === "remove"
  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-[11px] text-text-muted">
        <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 text-success" />
        {message}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-warning-border bg-warning-tint pl-2.5 pr-1.5 py-1">
      <span className="text-[11px] font-medium text-warning">Sample data — Riverside Academy demo</span>
      {phase === "idle" ? (
        <button
          type="button"
          onClick={() => setPhase("confirming")}
          className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-warning border border-warning-border hover:bg-warning-border transition-colors"
        >
          <Trash2 size={10} strokeWidth={2} />
          Remove
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {error && <span role="alert" className="text-[10px] text-danger">{error}</span>}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-full bg-danger-solid px-2 py-0.5 text-[10px] font-medium text-on-solid hover:bg-danger-solid-hover disabled:opacity-60 transition-colors"
          >
            {isPending ? <Loader2 size={10} className="animate-spin" /> : null}
            {isPending ? "Removing…" : "Confirm remove"}
          </button>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            disabled={isPending}
            className="text-[10px] font-medium text-warning hover:text-warning disabled:opacity-60"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
