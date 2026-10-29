"use client";

import { SMS_CONSENT_CERTIFICATION } from "@/lib/consent";

/** The required SMS consent checkbox shown before contacts are added (exact text is stored with the certification). */
export function ConsentCertification({ checked, onChange, compact = false }: { checked: boolean; onChange: (v: boolean) => void; compact?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${checked ? "border-line bg-canvas" : "border-amber-300 bg-amber-50"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--app-ink)]" />
      <span className={`${compact ? "text-[11px]" : "text-[12px]"} leading-relaxed text-ink-soft`}>
        <span className="font-semibold text-ink">Required: </span>
        {SMS_CONSENT_CERTIFICATION}
        <span className="mt-1 block text-[11px] text-ink-3">Your name, the time and this text are recorded.</span>
      </span>
    </label>
  );
}
