"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  OPS_BY_KIND,
  ROLE_OPTIONS,
  conditionsToNode,
  fieldChoices,
  newConditionId,
  nodeToConditions,
  type Condition,
  type FieldChoice,
  type FieldOp,
  type FilterNode,
  type RuleCatalog,
} from "@/lib/audienceRules";
import { GRADE_ORDER } from "@/lib/grades";
import type { ReachSummary } from "@/lib/family";

type Preview = {
  count: number;
  sample: { id: string; name: string; detail: string }[];
  reach: ReachSummary | null;
};

const selectCls = "rounded-md border border-line bg-card px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-ink-3";

function ValueInput({ choice, cond, onChange, catalog }: { choice: FieldChoice | undefined; cond: Condition; onChange: (v: string) => void; catalog: RuleCatalog }) {
  if (!choice || cond.op === "empty" || cond.op === "not_empty") return null;
  if (choice.kind === "role") {
    return (
      <select className={selectCls} value={cond.value} onChange={(e) => onChange(e.target.value)} aria-label="Role">
        <option value="">Choose…</option>
        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
    );
  }
  if (choice.kind === "grade") {
    return (
      <select className={selectCls} value={cond.value} onChange={(e) => onChange(e.target.value)} aria-label="Grade">
        <option value="">Choose…</option>
        {GRADE_ORDER.map((g) => <option key={g} value={g}>{g === "K" || g === "Pre-K" ? g : `Grade ${g}`}</option>)}
      </select>
    );
  }
  if (choice.kind === "tag") {
    return (
      <select className={selectCls} value={cond.value} onChange={(e) => onChange(e.target.value)} aria-label="Tag">
        <option value="">Choose…</option>
        {catalog.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    );
  }
  if (choice.kind === "select" && (choice.options?.length ?? 0) > 0) {
    return (
      <select className={selectCls} value={cond.value} onChange={(e) => onChange(e.target.value)} aria-label={choice.label}>
        <option value="">Choose…</option>
        {choice.options!.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return (
    <input
      className={`${selectCls} w-36`}
      type={choice.kind === "number" ? "number" : "text"}
      value={cond.value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={choice.kind === "number" ? "e.g. 2030" : "Value"}
      aria-label={choice.label}
    />
  );
}

/**
 * Smart audience rule editor: conditions on any field (role, grade, class,
 * division, team, tags…) joined by AND / OR, with a live member count, a
 * preview of who matches, and who a message would actually reach.
 */
export function RuleBuilder({
  catalog,
  initial,
  onChange,
}: {
  catalog: RuleCatalog;
  initial?: FilterNode | null;
  onChange: (rule: FilterNode | null) => void;
}) {
  const choices = fieldChoices(catalog);
  const start = nodeToConditions(initial ?? null);
  const editable = start !== null;
  const [conditions, setConditions] = useState<Condition[]>(
    start && start.conditions.length > 0 ? start.conditions : [{ id: newConditionId(), field: "role", op: "eq", value: "parent" }]
  );
  const [combinator, setCombinator] = useState<"and" | "or">(start?.combinator ?? "and");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const rule = editable ? conditionsToNode(conditions, combinator) : (initial ?? null);

  useEffect(() => {
    onChange(rule);
    if (timer.current) clearTimeout(timer.current);
    if (!rule) {
      setPreview(null);
      return;
    }
    const mine = ++seq.current;
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/audiences/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filter: rule }),
        });
        if (res.ok && mine === seq.current) setPreview((await res.json()) as Preview);
      } catch {
        // best-effort preview
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // The serialized rule is the only input that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(rule)]);

  function update(id: string, patch: Partial<Condition>) {
    setConditions((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function setField(id: string, field: string) {
    const choice = choices.find((c) => c.field === field)!;
    update(id, { field, op: OPS_BY_KIND[choice.kind][0].op, value: "" });
  }

  if (!editable) {
    return (
      <p className="rounded-lg border border-line bg-canvas p-4 text-[12px] text-ink-2">
        This rule is more complex than the builder can edit, but it still runs. To change it, create a new smart audience.
      </p>
    );
  }

  const r = preview?.reach;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {conditions.map((cond, i) => {
          const choice = choices.find((c) => c.field === cond.field);
          return (
            <div key={cond.id} className="flex flex-wrap items-center gap-2">
              {i === 0 ? (
                <span className="w-14 text-[12px] text-ink-3">Where</span>
              ) : (
                <select className={`${selectCls} w-14`} value={combinator} onChange={(e) => setCombinator(e.target.value as "and" | "or")} aria-label="Combine with">
                  <option value="and">AND</option>
                  <option value="or">OR</option>
                </select>
              )}
              <select className={selectCls} value={cond.field} onChange={(e) => setField(cond.id, e.target.value)} aria-label="Field">
                {choices.map((c) => <option key={c.field} value={c.field}>{c.label}</option>)}
              </select>
              <select className={selectCls} value={cond.op} onChange={(e) => update(cond.id, { op: e.target.value as FieldOp })} aria-label="Condition">
                {(choice ? OPS_BY_KIND[choice.kind] : []).map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
              </select>
              <ValueInput choice={choice} cond={cond} catalog={catalog} onChange={(value) => update(cond.id, { value })} />
              {conditions.length > 1 && (
                <button type="button" onClick={() => setConditions((cs) => cs.filter((c) => c.id !== cond.id))} aria-label="Remove condition" className="ml-auto rounded p-1 text-ink-3 hover:bg-muted hover:text-ink-soft">
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setConditions((cs) => [...cs, { id: newConditionId(), field: "grade", op: "eq", value: "" }])}
        className="inline-flex items-center gap-1 text-[12px] text-ink-2 hover:text-ink"
      >
        <Plus size={11} strokeWidth={2.5} /> Add condition
      </button>

      <div className="rounded-lg border border-line bg-card p-3" aria-live="polite">
        {!rule ? (
          <p className="text-[12px] text-ink-3">Pick a value to see who matches.</p>
        ) : !preview ? (
          <p className="text-[12px] text-ink-3">{loading ? "Counting…" : "—"}</p>
        ) : (
          <div className="space-y-2">
            <p className={`text-[13px] ${loading ? "opacity-50" : ""}`}>
              <span className="font-semibold tabular-nums text-ink">{preview.count.toLocaleString()}</span>{" "}
              <span className="text-ink-2">{preview.count === 1 ? "person matches" : "people match"}</span>
            </p>
            {r && r.matched > 0 && (
              <p className="text-[11px] leading-relaxed text-ink-3">
                A message reaches <span className="font-medium text-ink-2">{r.recipients.toLocaleString()}</span> {r.recipients === 1 ? "person" : "people"}
                {r.students > 0 && <> ({r.students} {r.students === 1 ? "student is" : "students are"} reached through {r.parentsOfStudents} {r.parentsOfStudents === 1 ? "parent" : "parents"}, each counted once)</>}
                {" · "}{r.withEmail} email · {r.withPhone} text · {r.withWhatsapp} WhatsApp
                {r.studentsWithoutParent > 0 && <span className="text-amber-700"> · {r.studentsWithoutParent} {r.studentsWithoutParent === 1 ? "student has" : "students have"} no parent linked</span>}
              </p>
            )}
            {preview.sample.length > 0 && (
              <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                {preview.sample.map((p) => (
                  <li key={p.id} className="truncate text-[12px] text-ink">
                    {p.name} {p.detail && <span className="text-[11px] text-ink-3">· {p.detail}</span>}
                  </li>
                ))}
                {preview.count > preview.sample.length && <li className="text-[11px] text-ink-3">+ {(preview.count - preview.sample.length).toLocaleString()} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
