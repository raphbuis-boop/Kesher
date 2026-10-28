"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, X, Undo2, UserCheck } from "lucide-react";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { reviewContacts, restoreRejected } from "./actions";

export type ReviewPerson = {
  id: string;
  name: string;
  detail: string;
  family: string;
  source: string;
  match: { id: string; name: string } | null;
};

export function ReviewQueue({ people, canReview, rejected }: { people: ReviewPerson[]; canReview: boolean; rejected: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-16 text-center">
        <UserCheck size={18} className="mb-3 text-line-strong" />
        <p className="text-[13px] font-semibold text-ink">{rejected ? "Nothing rejected" : "All caught up"}</p>
        <p className="mt-1 text-[12px] text-ink-3">{rejected ? "People you reject show up here." : "New people from syncs and parent signups will show up here."}</p>
      </div>
    );
  }

  const families = [...new Set(people.map((p) => p.family))];
  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  function decide(ids: string[], decision: "approve" | "reject") {
    start(async () => {
      const res = await reviewContacts(ids, decision);
      if (res.ok) {
        toast.success(res.message);
        toggle(ids, false);
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {canReview && !rejected && (
        <div className="sticky top-[104px] z-[5] flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 shadow-card">
          <label className="flex items-center gap-2 text-[12px] text-ink-2">
            <input
              type="checkbox"
              checked={selected.size === people.length}
              onChange={(e) => toggle(people.map((p) => p.id), e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--app-ink)]"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={pending || selected.size === 0} onClick={() => decide([...selected], "reject")} className="btn btn-secondary btn-sm">
              <X size={11} /> Reject
            </button>
            <button type="button" disabled={pending || selected.size === 0} onClick={() => decide([...selected], "approve")} className="btn btn-primary btn-sm">
              {pending ? <Spinner size={10} /> : <Check size={11} />} Approve
            </button>
          </div>
        </div>
      )}
      {!canReview && <p className="text-[12px] text-ink-3">Only owners and admins can approve or reject.</p>}

      {families.map((fam) => {
        const members = people.filter((p) => p.family === fam);
        const ids = members.map((m) => m.id);
        return (
          <section key={fam} className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <div className="flex items-center gap-3 border-b border-muted-2 bg-canvas px-4 py-2.5">
              {canReview && !rejected && (
                <input
                  type="checkbox"
                  aria-label={`Select ${fam}`}
                  checked={ids.every((id) => selected.has(id))}
                  onChange={(e) => toggle(ids, e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--app-ink)]"
                />
              )}
              <p className="flex-1 text-[12px] font-semibold text-ink">{fam}</p>
              {canReview && !rejected && (
                <button type="button" disabled={pending} onClick={() => decide(ids, "approve")} className="btn btn-ghost btn-sm">
                  Approve family
                </button>
              )}
            </div>
            <ul className="divide-y divide-muted">
              {members.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {canReview && !rejected && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={selected.has(p.id)}
                      onChange={(e) => toggle([p.id], e.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--app-ink)]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/people/${p.id}`} className="text-[13px] font-medium text-ink hover:text-ink-2">{p.name}</Link>
                    <p className="truncate text-[11px] text-ink-3">{p.detail || "No contact info"} · from {p.source}</p>
                    {p.match && (
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        Looks like <Link href={`/people/${p.match.id}`} className="underline underline-offset-2">{p.match.name}</Link>, who&apos;s already in your directory
                      </p>
                    )}
                  </div>
                  {canReview &&
                    (rejected ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const res = await restoreRejected(p.id);
                            if (res.ok) toast.success(res.message);
                            else toast.error(res.error);
                          })
                        }
                        className="btn btn-ghost btn-sm"
                      >
                        <Undo2 size={11} /> Back to review
                      </button>
                    ) : (
                      <div className="flex gap-1">
                        <button type="button" disabled={pending} onClick={() => decide([p.id], "reject")} aria-label={`Reject ${p.name}`} className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-red-600">
                          <X size={13} />
                        </button>
                        <button type="button" disabled={pending} onClick={() => decide([p.id], "approve")} aria-label={`Approve ${p.name}`} className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-emerald-600">
                          <Check size={13} />
                        </button>
                      </div>
                    ))}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
