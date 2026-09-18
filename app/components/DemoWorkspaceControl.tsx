"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, Loader2, CheckCircle2, X } from "lucide-react";
import { loadDemoDataAction, removeDemoDataAction } from "@/app/dashboard/demoActions";

type Phase = "idle" | "confirming" | "done";

export function DemoWorkspaceControl({ mode }: { mode: "load" | "remove" }) {
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

  if (mode === "load") {
    if (phase === "done") {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12px] text-emerald-700">
          <CheckCircle2 size={14} strokeWidth={2} className="shrink-0" />
          {message}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-[#e7e7e7] bg-white p-5">
        {phase === "idle" ? (
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100">
              <Sparkles size={16} className="text-emerald-600" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0f0f0f]">Your workspace is empty</p>
              <p className="mt-1 text-[12px] text-[#71717a] leading-relaxed">
                Load a fictional demo school — sample contacts, audiences, and message history — to explore
                Kesher or prepare a product demo. Fully reversible.
              </p>
              <button
                type="button"
                onClick={() => setPhase("confirming")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#27272a] transition-colors"
              >
                <Sparkles size={12} strokeWidth={2} />
                Load demo workspace
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[13px] font-semibold text-[#0f0f0f]">Load demo workspace?</p>
            <p className="mt-1 text-[12px] text-[#71717a] leading-relaxed">
              This adds a fictional school (&quot;Riverside Academy&quot;) with sample staff, families, audiences, and
              message history to this workspace only. No real emails, texts, or WhatsApp messages are sent —
              every contact uses fictional, non-deliverable details. You can remove it at any time.
            </p>
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#27272a] disabled:opacity-60 transition-colors"
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2} />}
                {isPending ? "Loading…" : "Yes, load demo data"}
              </button>
              <button
                type="button"
                onClick={() => setPhase("idle")}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border border-[#e7e7e7] px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:text-[#0f0f0f] disabled:opacity-60 transition-colors"
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
      <div className="flex items-center gap-2 rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[11px] text-[#71717a]">
        <CheckCircle2 size={13} strokeWidth={2} className="shrink-0 text-emerald-600" />
        {message}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 pl-2.5 pr-1.5 py-1">
      <span className="text-[11px] font-medium text-amber-800">Sample data — Riverside Academy demo</span>
      {phase === "idle" ? (
        <button
          type="button"
          onClick={() => setPhase("confirming")}
          className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
        >
          <Trash2 size={10} strokeWidth={2} />
          Remove
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {error && <span className="text-[10px] text-red-600">{error}</span>}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {isPending ? <Loader2 size={10} className="animate-spin" /> : null}
            {isPending ? "Removing…" : "Confirm remove"}
          </button>
          <button
            type="button"
            onClick={() => setPhase("idle")}
            disabled={isPending}
            className="text-[10px] font-medium text-amber-700 hover:text-amber-900 disabled:opacity-60"
          >
            Cancel
          </button>
        </span>
      )}
    </div>
  );
}
