"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { updateSmartAudience } from "@/app/groups/actions";
import type { FilterNode, RuleCatalog } from "@/lib/audienceRules";
import { RuleBuilder } from "./RuleBuilder";

/** "Edit rules" for a smart audience: rename, change the rule, see the live count. */
export function EditSmartAudience({
  groupId,
  name,
  description,
  rule,
  catalog,
}: {
  groupId: string;
  name: string;
  description: string;
  rule: FilterNode | null;
  catalog: RuleCatalog;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(name);
  const [d, setD] = useState(description);
  const [next, setNext] = useState<FilterNode | null>(rule);
  const [pending, start] = useTransition();
  const overlay = useRef<HTMLDivElement>(null);

  const inputCls = "w-full rounded-md border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-ink-3";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">
        <Pencil size={11} strokeWidth={2} /> Edit rules
      </button>
      {open && (
        <div
          ref={overlay}
          onClick={(e) => e.target === overlay.current && setOpen(false)}
          className="animate-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-10"
        >
          <div className="animate-pop-in w-full max-w-2xl rounded-xl border border-line bg-card shadow-pop">
            <div className="flex items-center justify-between border-b border-muted px-6 py-4">
              <h2 className="text-sm font-semibold text-ink">Edit smart audience</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 text-ink-3 hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <input value={n} onChange={(e) => setN(e.target.value)} className={inputCls} aria-label="Name" />
              <input value={d} onChange={(e) => setD(e.target.value)} className={inputCls} placeholder="Description (optional)" aria-label="Description" />
              <div className="rounded-lg border border-line bg-canvas p-4">
                <RuleBuilder catalog={catalog} initial={rule} onChange={setNext} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-muted px-6 py-3">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Cancel</button>
              <button
                type="button"
                disabled={pending || !next}
                onClick={() =>
                  start(async () => {
                    const res = await updateSmartAudience(groupId, { name: n, description: d, rule: next! });
                    if (res.success) {
                      toast.success("Audience updated");
                      setOpen(false);
                      router.refresh();
                    } else toast.error(res.error ?? "Couldn't save.");
                  })
                }
                className="btn btn-primary"
              >
                {pending && <Spinner />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
