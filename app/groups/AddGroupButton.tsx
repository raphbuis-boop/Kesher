"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addGroup, type AddGroupState } from "./actions";
import type { FilterNode } from "@/lib/resolveAudience";

export type Tag = {
  id: string;
  name: string;
};

const initialState: AddGroupState = { success: false, error: null };

const CATEGORY_OPTIONS = [
  { value: "parent", label: "Parents" },
  { value: "student", label: "Students" },
  { value: "faculty", label: "Faculty" },
  { value: "alumni", label: "Alumni" },
  { value: "donor", label: "Donors" },
  { value: "staff", label: "Staff" },
  { value: "board", label: "Board" },
  { value: "grandparent", label: "Grandparents" },
  { value: "prospect", label: "Prospects" },
];

const CURRENT_YEAR = new Date().getFullYear();

// ─── Filter builder (for dynamic audiences) ────────────────────────────────

type FilterCondition =
  | { id: string; type: "category"; value: string }
  | { id: string; type: "grad_year_range"; min: number; max: number }
  | { id: string; type: "grad_year_eq"; value: number };

function newId() {
  return Math.random().toString(36).slice(2);
}

function conditionsToFilterNode(
  conditions: FilterCondition[],
  combinator: "and" | "or"
): FilterNode | null {
  if (conditions.length === 0) return null;
  const nodes: FilterNode[] = conditions.map((c) => {
    if (c.type === "category") return { type: "category", value: c.value };
    if (c.type === "grad_year_eq") return { type: "grad_year_eq", value: c.value };
    return { type: "grad_year_range", min: c.min, max: c.max };
  });
  if (nodes.length === 1) return nodes[0];
  return { type: combinator, filters: nodes };
}

function FilterBuilder({
  onConfigChange,
}: {
  onConfigChange: (config: FilterNode | null) => void;
}) {
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { id: newId(), type: "category", value: "parent" },
  ]);
  const [combinator, setCombinator] = useState<"and" | "or">("and");
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateConditions(next: FilterCondition[]) {
    setConditions(next);
    const config = conditionsToFilterNode(next, combinator);
    onConfigChange(config);
    scheduleCount(next, combinator);
  }

  function updateCombinator(c: "and" | "or") {
    setCombinator(c);
    const config = conditionsToFilterNode(conditions, c);
    onConfigChange(config);
    scheduleCount(conditions, c);
  }

  function scheduleCount(conds: FilterCondition[], combo: "and" | "or") {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const config = conditionsToFilterNode(conds, combo);
    if (!config) { setMatchCount(null); return; }
    debounceRef.current = setTimeout(async () => {
      setCounting(true);
      try {
        const res = await fetch("/api/audiences/count", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: config }),
        });
        if (res.ok) {
          const data = await res.json();
          setMatchCount(data.count as number);
        }
      } catch {
        // count is best-effort
      } finally {
        setCounting(false);
      }
    }, 600);
  }

  function addCondition() {
    updateConditions([...conditions, { id: newId(), type: "category", value: "student" }]);
  }

  function removeCondition(id: string) {
    updateConditions(conditions.filter((c) => c.id !== id));
  }

  function setType(id: string, type: FilterCondition["type"]) {
    updateConditions(
      conditions.map((c) => {
        if (c.id !== id) return c;
        if (type === "category") return { id, type: "category", value: "parent" };
        if (type === "grad_year_eq") return { id, type: "grad_year_eq", value: CURRENT_YEAR };
        return { id, type: "grad_year_range", min: CURRENT_YEAR, max: CURRENT_YEAR + 4 };
      })
    );
  }

  const SELECT = "rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";
  const INPUT = "w-20 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 transition-colors";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {conditions.map((cond, i) => (
          <div key={cond.id} className="flex items-center gap-2 flex-wrap">
            {i > 0 && (
              <select
                className={SELECT + " w-16"}
                value={combinator}
                onChange={(e) => updateCombinator(e.target.value as "and" | "or")}
              >
                <option value="and">AND</option>
                <option value="or">OR</option>
              </select>
            )}
            {i === 0 && <span className="text-sm text-zinc-400 w-16">WHERE</span>}

            {/* Field type */}
            <select
              className={SELECT}
              value={cond.type}
              onChange={(e) => setType(cond.id, e.target.value as FilterCondition["type"])}
            >
              <option value="category">Role / Category</option>
              <option value="grad_year_eq">Graduating Year (exact)</option>
              <option value="grad_year_range">Graduating Year (range)</option>
            </select>

            {/* Value(s) */}
            {cond.type === "category" && (
              <select
                className={SELECT}
                value={cond.value}
                onChange={(e) =>
                  updateConditions(
                    conditions.map((c) =>
                      c.id === cond.id ? { ...c, value: e.target.value } : c
                    )
                  )
                }
              >
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}

            {cond.type === "grad_year_eq" && (
              <input
                type="number"
                className={INPUT}
                value={cond.value}
                min={2000}
                max={2100}
                onChange={(e) =>
                  updateConditions(
                    conditions.map((c) =>
                      c.id === cond.id
                        ? { ...c, value: parseInt(e.target.value, 10) || CURRENT_YEAR }
                        : c
                    )
                  )
                }
              />
            )}

            {cond.type === "grad_year_range" && (
              <>
                <input
                  type="number"
                  className={INPUT}
                  value={cond.min}
                  min={2000}
                  max={2100}
                  onChange={(e) =>
                    updateConditions(
                      conditions.map((c) =>
                        c.id === cond.id
                          ? { ...c, min: parseInt(e.target.value, 10) || CURRENT_YEAR }
                          : c
                      )
                    )
                  }
                />
                <span className="text-sm text-zinc-400">–</span>
                <input
                  type="number"
                  className={INPUT}
                  value={cond.max}
                  min={2000}
                  max={2100}
                  onChange={(e) =>
                    updateConditions(
                      conditions.map((c) =>
                        c.id === cond.id
                          ? { ...c, max: parseInt(e.target.value, 10) || CURRENT_YEAR + 4 }
                          : c
                      )
                    )
                  }
                />
              </>
            )}

            {conditions.length > 1 && (
              <button
                type="button"
                onClick={() => removeCondition(cond.id)}
                className="ml-auto rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addCondition}
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-800"
        >
          + Add condition
        </button>
        <span className="text-xs text-zinc-400">
          {counting ? (
            "Counting…"
          ) : matchCount !== null ? (
            <span className={matchCount > 0 ? "text-zinc-700 font-medium" : "text-zinc-400"}>
              {matchCount.toLocaleString()} {matchCount === 1 ? "contact" : "contacts"} match
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

// ─── Form ──────────────────────────────────────────────────────────────────────

function AddGroupForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [state, formAction, isPending] = useActionState(addGroup, initialState);
  const [mode, setMode] = useState<"manual" | "dynamic">("manual");
  const [filterConfig, setFilterConfig] = useState<FilterNode | null>(null);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} noValidate>
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="ag-name" className="block text-sm font-medium text-zinc-700 mb-1">
            Audience Name <span className="text-red-500">*</span>
          </label>
          <input
            id="ag-name"
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 transition-colors disabled:opacity-50"
            placeholder="Class of 2028 Families"
            disabled={isPending}
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="ag-desc" className="block text-sm font-medium text-zinc-700 mb-1">
            Description
          </label>
          <textarea
            id="ag-desc"
            name="description"
            rows={2}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 transition-colors disabled:opacity-50 resize-none"
            placeholder="Optional description…"
            disabled={isPending}
          />
        </div>

        {/* Mode tabs */}
        <div>
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 w-fit">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                (mode === "manual" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")
              }
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setMode("dynamic")}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                (mode === "dynamic" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")
              }
            >
              Dynamic rules
            </button>
          </div>

          <p className="mt-1.5 text-xs text-zinc-400">
            {mode === "manual"
              ? "After creating, you'll add contacts from the audience page."
              : "Membership is computed live from contact data — always stays current."}
          </p>
        </div>

        {/* Dynamic filter builder */}
        {mode === "dynamic" && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <FilterBuilder onConfigChange={setFilterConfig} />
            {filterConfig && (
              <input
                type="hidden"
                name="filter_config"
                value={JSON.stringify(filterConfig)}
              />
            )}
          </div>
        )}

        {state.error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isPending || (mode === "dynamic" && !filterConfig)}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Saving…
            </>
          ) : (
            "Save Audience"
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Button + modal ────────────────────────────────────────────────────────────

export function AddGroupButton() {
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
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Custom Audience
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Add Custom Audience</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Tag-based or dynamic rule-based.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5">
              <AddGroupForm onSuccess={() => setOpen(false)} />
            </div>
            <div className="border-t border-zinc-100 px-6 py-3">
              <button onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
