"use client";

import { useActionToast } from "@/app/components/ui/toast";
import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X, Sparkles, Hand } from "lucide-react";
import { RuleBuilder } from "@/app/audiences/RuleBuilder";
import { addGroup, type AddGroupState } from "./actions";
import type { FilterNode, RuleCatalog } from "@/lib/audienceRules";

export type Tag = {
  id: string;
  name: string;
};

const initialState: AddGroupState = { success: false, error: null };

const inputCls =
  "w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink placeholder-ink-3 outline-none focus:border-ink-3 transition-colors disabled:opacity-50";

function AddGroupForm({ catalog, onSuccess }: { catalog: RuleCatalog; onSuccess: () => void }) {
  const [state, formAction, isPending] = useActionState(addGroup, initialState);
  useActionToast(state, (s) => ({ success: s.success ? "Audience created" : null }));
  const [mode, setMode] = useState<"static" | "smart">("smart");
  const [rule, setRule] = useState<FilterNode | null>(null);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} noValidate>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            { v: "smart" as const, icon: Sparkles, title: "Smart audience", body: "Saved rules like Grade 5 AND Division Boys. Always current — checked every time you send." },
            { v: "static" as const, icon: Hand, title: "Hand-picked", body: "You choose the people. Good for committees and one-off lists." },
          ]).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${mode === o.v ? "border-ink bg-card shadow-card" : "border-line bg-canvas hover:border-line-strong"}`}
            >
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink"><o.icon size={13} strokeWidth={2} />{o.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{o.body}</p>
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="ag-name" className="mb-1 block text-sm font-medium text-ink-soft">
            Audience name <span className="text-red-500">*</span>
          </label>
          <input id="ag-name" name="name" type="text" required className={inputCls} placeholder={mode === "smart" ? "5th grade boys" : "Dinner committee"} disabled={isPending} />
        </div>

        <div>
          <label htmlFor="ag-desc" className="mb-1 block text-sm font-medium text-ink-soft">Description</label>
          <textarea id="ag-desc" name="description" rows={2} className={`${inputCls} resize-none`} placeholder="Optional" disabled={isPending} />
        </div>

        {mode === "smart" ? (
          <div className="rounded-lg border border-line bg-canvas p-4">
            <RuleBuilder catalog={catalog} onChange={setRule} />
            {rule && <input type="hidden" name="filter_config" value={JSON.stringify(rule)} />}
          </div>
        ) : (
          <p className="text-xs text-ink-3">After creating it, you&apos;ll add people from the audience page.</p>
        )}

        {state.error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isPending || (mode === "smart" && !rule)}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-on-ink transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save audience"}
        </button>
      </div>
    </form>
  );
}

export function AddGroupButton({ catalog }: { catalog: RuleCatalog }) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-on-ink transition-colors hover:bg-ink-hover">
        <Plus size={14} strokeWidth={2} />
        Add custom audience
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          className="animate-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10"
        >
          <div className="animate-pop-in w-full max-w-2xl rounded-xl border border-line bg-card shadow-pop">
            <div className="flex items-center justify-between border-b border-muted px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Add custom audience</h2>
                <p className="mt-0.5 text-xs text-ink-2">Smart (rule-based) or hand-picked.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 text-ink-3 transition-colors hover:bg-muted hover:text-ink-soft">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5">
              <AddGroupForm catalog={catalog} onSuccess={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
