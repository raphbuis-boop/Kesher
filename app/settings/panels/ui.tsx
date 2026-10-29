"use client";

import { useTransition } from "react";
import { toast } from "@/app/components/ui/toast";

/** Shared building blocks for the server-loaded Settings panels (same look as SettingsShell). */

export const inputCls =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink placeholder-line-strong outline-none transition-[border-color,background-color,box-shadow] duration-150 focus:border-ink-3 focus:bg-card focus:shadow-card disabled:opacity-50";

export function Panel({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card shadow-card">
      <div className="px-5 pt-5">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {description && <div className="mt-1 text-[12px] leading-relaxed text-ink-2">{description}</div>}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-canvas px-5 py-3">{footer}</div>
      )}
    </section>
  );
}

export function FieldLabel({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-3">{hint}</span>}
    </label>
  );
}

export function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-emerald-500/10 text-emerald-700 [[data-theme=dark]_&]:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-700 [[data-theme=dark]_&]:text-amber-300",
    bad: "bg-red-500/10 text-red-600 [[data-theme=dark]_&]:text-red-400",
    muted: "bg-muted text-ink-2",
  }[tone];
  const dot = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", muted: "bg-ink-4" }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Runs a server action in a transition and toasts the result. */
export function useAction() {
  const [pending, start] = useTransition();
  function run(fn: () => Promise<Result>, success: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? success);
        after?.();
      } else toast.error(res.error);
    });
  }
  return { pending, run };
}
