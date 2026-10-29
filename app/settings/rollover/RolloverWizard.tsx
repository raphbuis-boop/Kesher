"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, GraduationCap, Undo2 } from "lucide-react";
import { Spinner } from "@/app/components/ui/Spinner";
import { toast } from "@/app/components/ui/toast";
import { GRADE_ORDER } from "@/lib/grades";
import { applyRollover, previewRollover, undoRollover, type PlanView } from "./actions";

export type RolloverRun = {
  id: string;
  school_year: string;
  top_grade: string;
  promoted_count: number;
  graduated_count: number;
  parents_archived: number;
  status: "applying" | "applied" | "failed" | "undone";
  created_at: string;
  error: string | null;
};

const selectCls = "rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-ink-3";

function gradeLabel(g: string) {
  return g === "K" || g === "Pre-K" ? g : `Grade ${g}`;
}

function History({ runs }: { runs: RolloverRun[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (runs.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Previous rollovers</h2>
      <ul className="divide-y divide-muted overflow-hidden rounded-xl border border-line bg-card shadow-card">
        {runs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">
                {r.school_year} <span className="text-[11px] font-normal text-ink-3">· {new Date(r.created_at).toLocaleDateString()}</span>
              </p>
              <p className="text-[11px] tabular-nums text-ink-3">
                {r.promoted_count} promoted · {r.graduated_count} graduated{r.parents_archived ? ` · ${r.parents_archived} parents archived` : ""}
                {r.status === "undone" && " · undone"}
                {r.status === "failed" && <span className="text-red-600"> · stopped partway: {r.error}</span>}
              </p>
            </div>
            {(r.status === "applied" || r.status === "failed") && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Undo this rollover? Everyone it changed goes back (anyone edited since is left alone).")) return;
                  start(async () => {
                    const res = await undoRollover(r.id);
                    if (res.ok) {
                      toast.success(res.message);
                      router.refresh();
                    } else toast.error(res.error);
                  });
                }}
                className="btn btn-secondary btn-sm"
              >
                {pending ? <Spinner size={10} /> : <Undo2 size={11} />} Undo
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RolloverWizard({
  suggestedTop,
  studentCount,
  schoolYear,
  runs,
}: {
  suggestedTop: string;
  studentCount: number;
  schoolYear: string;
  runs: RolloverRun[];
}) {
  const router = useRouter();
  const [top, setTop] = useState(suggestedTop);
  const [archiveParents, setArchiveParents] = useState(true);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, startApply] = useTransition();
  const [confirmText, setConfirmText] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const recent = runs.find((r) => r.status === "applied" && nowMs - new Date(r.created_at).getTime() < 200 * 86_400_000);

  async function preview(nextTop = top, nextArchive = archiveParents) {
    setLoading(true);
    const res = await previewRollover(nextTop, nextArchive);
    setLoading(false);
    if (!res.ok) return toast.error(res.error);
    setPlan(res.plan);
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-800 [[data-theme=dark]_&]:text-emerald-300">
          <Check size={14} className="mr-1.5 inline" /> {done}
        </div>
        <p className="text-[12px] text-ink-2">Class, homeroom and similar fields aren&apos;t changed by the rollover — update them in your next import or sync.</p>
        <button type="button" className="btn btn-secondary" onClick={() => { setDone(null); setPlan(null); router.refresh(); }}>Done</button>
        <History runs={runs} />
      </div>
    );
  }

  if (studentCount === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
        <GraduationCap size={18} className="mx-auto mb-3 text-line-strong" />
        <p className="text-[13px] font-semibold text-ink">No students yet</p>
        <p className="mt-1 text-[12px] text-ink-3">Import your students (with a grade) first, then come back at the end of the school year.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1 */}
      <section className="rounded-xl border border-line bg-card p-5 shadow-card">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Step 1 · Your school</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink-soft">Last grade at your school</span>
            <select
              value={top}
              onChange={(e) => { setTop(e.target.value); setPlan(null); }}
              className={`${selectCls} w-full`}
            >
              {GRADE_ORDER.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-ink-3">Students in this grade graduate; everyone else moves up one. We guessed from your students.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 pt-5 text-[12px] text-ink-2">
            <input
              type="checkbox"
              checked={archiveParents}
              onChange={(e) => { setArchiveParents(e.target.checked); setPlan(null); }}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--app-ink)]"
            />
            <span>
              Also archive parents who have no child left at the school
              <span className="block text-[11px] text-ink-3">Only people who are just parents. Archived people keep their history but get no messages.</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={loading} onClick={() => preview()} className="btn btn-primary">
            {loading ? <Spinner /> : <ArrowRight size={13} />} Preview {schoolYear} rollover
          </button>
        </div>
      </section>

      {/* Step 2 */}
      {plan && (
        <section className="space-y-4 rounded-xl border border-line bg-card p-5 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Step 2 · Review what will change</p>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                  <th className="px-3 py-2">From</th>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2 text-right">Students</th>
                </tr>
              </thead>
              <tbody>
                {plan.byGrade.map((b) => (
                  <tr key={b.from} className="border-b border-muted last:border-0">
                    <td className="px-3 py-2 text-[13px] text-ink">{gradeLabel(b.from)}</td>
                    <td className="px-3 py-2 text-[13px] text-ink-2">{b.to.startsWith("Graduates") ? b.to : gradeLabel(b.to)}</td>
                    <td className="px-3 py-2 text-right text-[13px] tabular-nums text-ink">{b.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plan.graduateCount > 0 && (
            <details className="rounded-lg border border-line px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium text-ink">
                {plan.graduateCount} {plan.graduateCount === 1 ? "student graduates" : "students graduate"} and {plan.graduateCount === 1 ? "is" : "are"} archived
              </summary>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{plan.graduates.map((g) => g.name).join(", ")}{plan.graduateCount > plan.graduates.length ? ` and ${plan.graduateCount - plan.graduates.length} more` : ""}</p>
            </details>
          )}
          {plan.archiveParents && (
            <details className="rounded-lg border border-line px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium text-ink">
                {plan.parentCount} {plan.parentCount === 1 ? "parent has" : "parents have"} no child left and will be archived
              </summary>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{plan.parentCount === 0 ? "None." : plan.parents.map((p) => p.name).join(", ")}</p>
            </details>
          )}
          {plan.skippedCount > 0 && (
            <details className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-medium text-amber-800 [[data-theme=dark]_&]:text-amber-300">
                {plan.skippedCount} {plan.skippedCount === 1 ? "student" : "students"} can&apos;t be promoted automatically
              </summary>
              <ul className="mt-2 space-y-0.5 text-[12px] text-ink-2">
                {plan.skipped.map((s) => <li key={s.id}>{s.name} — {s.reason}</li>)}
              </ul>
            </details>
          )}
          {plan.syncedStudents > 0 && (
            <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 [[data-theme=dark]_&]:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>
                {plan.syncedStudents} students get their grade from an imported list or Google Sheet. If that list still has last year&apos;s
                grades, the next sync will set them back — and a graduate still on the list will be restored. Update the list for the new year, then sync.
              </p>
            </div>
          )}

          {/* Step 3 */}
          <div className="border-t border-line pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Step 3 · Confirm</p>
            {recent && (
              <div className="mt-3 flex gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <p>A rollover for {recent.school_year} was already applied on {new Date(recent.created_at).toLocaleDateString()}. Running again promotes everyone a second time. Type <b>ROLL OVER AGAIN</b> to continue.</p>
              </div>
            )}
            {recent && (
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={`${selectCls} mt-3 w-full`} placeholder="ROLL OVER AGAIN" aria-label="Type ROLL OVER AGAIN to confirm" />
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[11px] text-ink-3">You can undo this afterwards from Previous rollovers.</p>
              <button
                type="button"
                disabled={applying || plan.promotionCount + plan.graduateCount === 0 || (!!recent && confirmText.trim().toUpperCase() !== "ROLL OVER AGAIN")}
                onClick={() =>
                  startApply(async () => {
                    const res = await applyRollover({ topGrade: plan.topGrade, archiveParents: plan.archiveParents, hash: plan.hash, confirmAgain: !!recent });
                    if (res.ok) {
                      toast.success("Rollover applied");
                      setDone(res.message);
                    } else toast.error(res.error);
                  })
                }
                className="btn btn-primary"
              >
                {applying ? <Spinner /> : <GraduationCap size={13} />} {applying ? "Applying…" : `Promote ${plan.promotionCount} · graduate ${plan.graduateCount}`}
              </button>
            </div>
          </div>
        </section>
      )}

      <History runs={runs} />
    </div>
  );
}
