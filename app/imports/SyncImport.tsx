"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, FileSpreadsheet, Info } from "lucide-react";
import { GlassDropzone } from "@/app/components/ui/GlassDropzone";
import { Spinner } from "@/app/components/ui/Spinner";
import { toast } from "@/app/components/ui/toast";
import {
  ID_TARGETS,
  TARGETS,
  headerOverlap,
  suggestMapping,
  type ColumnMapping,
  type RowMode,
  type TableData,
} from "@/lib/sync/mapping";
import { cellToString, parseCsv, toTable } from "@/lib/sync/table";
import type { RunSummary } from "@/lib/sync/runs";
import type { PersonDiff } from "@/lib/sync/engine";
import { applySyncRun, discardSyncRun } from "./syncActions";
import { ConsentCertification } from "@/app/components/ConsentCertification";

export type SourceOption = { id: string; name: string; mapping: ColumnMapping | null };

type Stage = "pick" | "map" | "preview" | "done";

const selectCls =
  "w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[12px] text-ink outline-none focus:border-ink-3 focus:bg-card";

async function readFile(file: File): Promise<TableData> {
  if (/\.(xlsx|xlsm)$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return toTable(data.map((r) => r.map((c) => cellToString(c))));
  }
  if (/\.xls$/i.test(file.name)) throw new Error("Old .xls files aren't supported — save it as .xlsx or .csv and try again.");
  return toTable(parseCsv(await file.text()));
}

// ─── Mapping step ─────────────────────────────────────────────────────────────

export function MappingStep({
  table,
  mapping,
  setMapping,
  customFields,
}: {
  table: TableData;
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
  customFields: { key: string; label: string }[];
}) {
  const targets = TARGETS.filter((t) => t.modes.includes(mapping.mode));
  const groups = [...new Set(targets.map((t) => t.group))];
  const used = new Set(Object.values(mapping.columns));
  const hasId = ID_TARGETS[mapping.mode].some((t) => used.has(t));

  function setTarget(header: string, target: string) {
    const columns = { ...mapping.columns };
    // A target maps from one column at a time
    for (const [h, t] of Object.entries(columns)) if (t === target && h !== header && target !== "ignore") delete columns[h];
    if (target === "ignore") delete columns[header];
    else columns[header] = target;
    setMapping({ ...mapping, columns });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {(["student", "person"] as RowMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setMapping({ ...suggestMapping(table.headers, customFields), mode })}
            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
              mapping.mode === mode ? "border-ink bg-card shadow-card" : "border-line bg-canvas hover:border-line-strong"
            }`}
          >
            <p className="text-[13px] font-medium text-ink">{mode === "student" ? "One row per student" : "One row per person"}</p>
            <p className="mt-0.5 text-[11px] text-ink-3">
              {mode === "student" ? "Student columns plus their parents on the same row (most school exports)" : "Parents, students and staff each on their own row"}
            </p>
          </button>
        ))}
      </div>

      {!hasId && (
        <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 [[data-theme=dark]_&]:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>
            No ID column is mapped. Map a {mapping.mode === "student" ? "Student ID or Family ID" : "Person ID or Family ID"} column if your file has
            one — otherwise Kesher matches people by email, then phone, then name, and someone whose email changes will look like a new person.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-line">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line bg-canvas text-left text-[10px] font-semibold uppercase tracking-wide text-ink-3">
              <th className="px-3 py-2">Column in your file</th>
              <th className="hidden px-3 py-2 sm:table-cell">Example</th>
              <th className="px-3 py-2 w-[46%]">Kesher field</th>
            </tr>
          </thead>
          <tbody>
            {table.headers.map((h, i) => {
              const sample = table.rows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(" · ");
              return (
                <tr key={h} className="border-b border-muted last:border-0">
                  <td className="px-3 py-2 text-[12px] font-medium text-ink">{h}</td>
                  <td className="hidden max-w-[200px] truncate px-3 py-2 text-[11px] text-ink-3 sm:table-cell" title={sample}>{sample || "—"}</td>
                  <td className="px-3 py-1.5">
                    <select value={mapping.columns[h] ?? "ignore"} onChange={(e) => setTarget(h, e.target.value)} className={selectCls} aria-label={`Field for ${h}`}>
                      <option value="ignore">Don&apos;t import</option>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {targets.filter((t) => t.group === g).map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </optgroup>
                      ))}
                      {customFields.length > 0 && (
                        <optgroup label="School fields">
                          {customFields.map((c) => <option key={c.key} value={`custom:${c.key}`}>{c.label}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mapping.mode === "student" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["p1Relationship", "p2Relationship"] as const).map((k, i) => (
            <label key={k} className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-2">Parent {i + 1} is usually the…</span>
              <select
                value={mapping.defaults?.[k] ?? "parent"}
                onChange={(e) => setMapping({ ...mapping, defaults: { ...mapping.defaults, [k]: e.target.value } })}
                className={selectCls}
              >
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="parent">Parent</option>
                <option value="guardian">Guardian</option>
              </select>
            </label>
          ))}
        </div>
      ) : (
        <label className="block max-w-xs">
          <span className="mb-1 block text-[11px] font-medium text-ink-2">Rows without a role are…</span>
          <select
            value={mapping.defaults?.personKind ?? "other"}
            onChange={(e) => setMapping({ ...mapping, defaults: { ...mapping.defaults, personKind: e.target.value as "other" } })}
            className={selectCls}
          >
            <option value="guardian">Parents</option>
            <option value="student">Students</option>
            <option value="staff">Staff</option>
            <option value="faculty">Faculty</option>
            <option value="other">Other contacts</option>
          </select>
        </label>
      )}
      {customFields.length === 0 && (
        <p className="text-[11px] text-ink-3">
          Columns like Class, Division or Bus route? Add them as school fields in{" "}
          <Link href="/settings#data" className="underline underline-offset-2 hover:text-ink">Settings → Data</Link> first, then map them here.
        </p>
      )}
    </div>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────────

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "good" | "bad" }) {
  const color = tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className={`mt-1 text-[20px] font-semibold tabular-nums ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function Section({ title, count, children, defaultOpen = false }: { title: string; count: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="rounded-xl border border-line bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-[13px] font-medium text-ink">
          {title} <span className="ml-1 tabular-nums text-ink-3">{count.toLocaleString()}</span>
        </span>
        <ChevronDown size={14} className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="max-h-80 overflow-y-auto border-t border-muted px-4 py-2">{children}</div>}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { guardian: "Parent", student: "Student", staff: "Staff", faculty: "Faculty", other: "Contact" };
const MATCH_LABEL: Record<string, string> = { email: "matched your existing contact by email", phone: "matched your existing contact by phone", name: "matched your existing contact by name" };

function PersonLine({ p }: { p: PersonDiff }) {
  return (
    <li className="py-2">
      <p className="text-[12px] text-ink">
        <span className="font-medium">{p.name}</span>
        <span className="ml-1.5 text-[11px] text-ink-3">{KIND_LABEL[p.kind]}</span>
        {p.matchedBy && p.matchedBy !== "source_id" && <span className="ml-1.5 text-[11px] text-brand">· {MATCH_LABEL[p.matchedBy]}</span>}
        {p.pending && <span className="ml-1.5 text-[11px] text-amber-600">· waiting for review</span>}
      </p>
      {p.changes && p.changes.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {p.changes.map((c, i) => (
            <li key={i} className="text-[11px] text-ink-2">
              {c.field}: <span className="text-ink-3 line-through">{c.from || "empty"}</span> → <span className="text-ink">{c.to || "empty"}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function RunDiffView({ run }: { run: RunSummary }) {
  const s = run.stats;
  const people = run.diff?.people ?? [];
  const byAction = (a: PersonDiff["action"]) => people.filter((p) => p.action === a);
  const missing = run.diff?.missing ?? [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="New" value={s.new ?? 0} tone="good" />
        <Stat label="Updated" value={(s.updated ?? 0) + (s.restored ?? 0)} />
        <Stat label="Unchanged" value={s.unchanged ?? 0} />
        <Stat label="Missing" value={s.missing ?? 0} tone={s.missing ? "warn" : undefined} />
        <Stat label="Problems" value={s.problems ?? run.problems.length} tone={run.problems.length ? "bad" : undefined} />
      </div>

      {run.warnings.map((w, i) => (
        <div key={i} className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 [[data-theme=dark]_&]:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>{w}</p>
        </div>
      ))}

      {(s.queued ?? 0) > 0 && (
        <p className="flex gap-2 text-[12px] text-ink-2">
          <Info size={14} className="mt-0.5 shrink-0 text-ink-3" />
          {s.queued} new {s.queued === 1 ? "person goes" : "people go"} to Review new contacts and won&apos;t get messages until you approve them.
        </p>
      )}

      <div className="space-y-2">
        <Section title="New" count={byAction("new").length} defaultOpen>
          <ul className="divide-y divide-muted">{byAction("new").map((p) => <PersonLine key={p.sourceId} p={p} />)}</ul>
        </Section>
        <Section title="Updated" count={byAction("update").length + byAction("restore").length} defaultOpen>
          <ul className="divide-y divide-muted">
            {[...byAction("restore"), ...byAction("update")].map((p) => (
              <PersonLine key={p.sourceId} p={p.action === "restore" ? { ...p, changes: [{ field: "Status", from: "archived", to: "active" }, ...(p.changes ?? [])] } : p} />
            ))}
          </ul>
        </Section>
        <Section title="Missing from this file" count={missing.length}>
          <ul className="divide-y divide-muted">
            {missing.map((m) => (
              <li key={m.personId} className="py-2 text-[12px] text-ink">
                <span className="font-medium">{m.name}</span>{" "}
                <span className={`text-[11px] ${m.willArchive ? "text-red-600" : "text-ink-3"}`}>
                  {m.willArchive ? "— missing 3 times in a row, will be archived" : `— missing ${m.missingCount} of 3 times before archiving`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Rows with problems" count={run.problems.length}>
          <ul className="divide-y divide-muted">
            {run.problems.map((p, i) => (
              <li key={i} className="py-2 text-[12px] text-ink-2"><span className="tabular-nums text-ink-3">Row {p.row}:</span> {p.message}</li>
            ))}
          </ul>
        </Section>
        <Section title="Skipped (rejected in review earlier)" count={byAction("skip_rejected").length}>
          <ul className="divide-y divide-muted">{byAction("skip_rejected").map((p) => <PersonLine key={p.sourceId} p={p} />)}</ul>
        </Section>
        <Section title="Unchanged" count={byAction("unchanged").length}>
          <ul className="divide-y divide-muted">{byAction("unchanged").map((p) => <PersonLine key={p.sourceId} p={p} />)}</ul>
        </Section>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function SyncImport({
  sources,
  customFields,
}: {
  sources: SourceOption[];
  customFields: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("pick");
  const [table, setTable] = useState<TableData | null>(null);
  const [fileName, setFileName] = useState("");
  const [sourceId, setSourceId] = useState<string>("new");
  const [newName, setNewName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, startApply] = useTransition();
  const [certified, setCertified] = useState(false);

  const bestSource = useMemo(() => {
    if (!table) return null;
    let best: { s: SourceOption; score: number } | null = null;
    for (const s of sources) {
      if (!s.mapping) continue;
      const score = headerOverlap(table.headers, s.mapping);
      if (!best || score > best.score) best = { s, score };
    }
    return best && best.score >= 0.6 ? best : null;
  }, [table, sources]);

  async function preview(t: TableData, m: ColumnMapping, sid: string, name: string, fname: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/sync/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: sid === "new" ? undefined : sid,
          sourceName: sid === "new" ? name || fname.replace(/\.[^.]+$/, "") : undefined,
          mapping: m,
          fileName: fname,
          headers: t.headers,
          rows: t.rows,
        }),
      });
      const data = (await res.json()) as { sourceId?: string; run?: RunSummary; error?: string };
      if (data.sourceId) setSourceId(data.sourceId);
      if (!res.ok || !data.run) throw new Error(data.error ?? "Preview failed.");
      setRun(data.run);
      setStage("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setLoading(false);
    }
  }

  async function onFile(file: File) {
    const t = await readFile(file);
    if (t.headers.length === 0 || t.rows.length === 0) throw new Error("That file looks empty.");
    setTable(t);
    setFileName(file.name);
    setRun(null);

    // Re-upload of a list we know: same columns → straight to the preview
    let best: { s: SourceOption; score: number } | null = null;
    for (const s of sources) {
      if (!s.mapping) continue;
      const score = headerOverlap(t.headers, s.mapping);
      if (!best || score > best.score) best = { s, score };
    }
    if (best && best.score === 1 && best.s.mapping) {
      setSourceId(best.s.id);
      setMapping(best.s.mapping);
      await preview(t, best.s.mapping, best.s.id, "", file.name);
      return;
    }
    if (best && best.score >= 0.6 && best.s.mapping) {
      const suggested = suggestMapping(t.headers, customFields);
      setSourceId(best.s.id);
      setMapping({
        ...best.s.mapping,
        columns: Object.fromEntries(
          t.headers
            .map((h) => [h, best!.s.mapping!.columns[h] ?? (suggested.mode === best!.s.mapping!.mode ? suggested.columns[h] : undefined)])
            .filter((e): e is [string, string] => !!e[1])
        ),
      });
    } else {
      setSourceId("new");
      setNewName(file.name.replace(/\.[^.]+$/, ""));
      setMapping(suggestMapping(t.headers, customFields));
    }
    setStage("map");
  }

  function reset() {
    setStage("pick");
    setTable(null);
    setRun(null);
    setMapping(null);
  }

  if (stage === "pick" || !table || !mapping) {
    return (
      <div className="space-y-3">
        <GlassDropzone
          accept=".csv,.tsv,.txt,.xlsx,.xlsm"
          acceptLabel="a CSV or Excel (.xlsx) file"
          isAccepted={(f) => /\.(csv|tsv|txt|xlsx|xlsm|xls)$/i.test(f.name)}
          maxBytes={15 * 1024 * 1024}
          title="Drop your roster here, or browse"
          hint="CSV or Excel · read in your browser, never stored"
          onUpload={async (file) => {
            await onFile(file);
          }}
          resetAfterSuccess={800}
        />
        {loading && (
          <p className="flex items-center gap-2 text-[12px] text-ink-3"><Spinner /> Comparing with your directory…</p>
        )}
        <p className="text-[11px] leading-relaxed text-ink-3">
          Export your families from FACTS, Veracross, Blackbaud or any spreadsheet. Kesher shows exactly what will change before anything
          is saved. Uploading the same list again later only applies the differences.
        </p>
      </div>
    );
  }

  if (stage === "map") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
          <FileSpreadsheet size={16} className="shrink-0 text-ink-3" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{fileName}</p>
            <p className="text-[11px] text-ink-3">{table.rows.length.toLocaleString()} rows · {table.headers.length} columns</p>
          </div>
          <button type="button" onClick={reset} className="btn btn-ghost btn-sm">Change file</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">This file updates…</span>
            <select
              value={sourceId}
              onChange={(e) => {
                const id = e.target.value;
                setSourceId(id);
                const s = sources.find((x) => x.id === id);
                if (s?.mapping) setMapping(s.mapping);
              }}
              className={selectCls}
            >
              <option value="new">A new list</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{bestSource?.s.id === s.id ? " (same columns)" : ""}
                </option>
              ))}
            </select>
          </label>
          {sourceId === "new" && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-ink-2">List name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Student roster" className={selectCls} />
            </label>
          )}
        </div>

        <MappingStep table={table} mapping={mapping} setMapping={setMapping} customFields={customFields} />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-3">The mapping is saved, so next time this list uploads in one click.</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => preview(table, mapping, sourceId, newName, fileName)}
            className="btn btn-primary"
          >
            {loading && <Spinner />} Preview changes
          </button>
        </div>
      </div>
    );
  }

  if (stage === "preview" && run) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setStage("map")} className="btn btn-ghost btn-sm">
            <ArrowLeft size={12} /> Edit mapping
          </button>
          <p className="truncate text-[12px] text-ink-3">{fileName}</p>
        </div>
        <RunDiffView run={run} />
        <ConsentCertification checked={certified} onChange={setCertified} />
        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            disabled={applying}
            onClick={async () => {
              await discardSyncRun(run.id);
              reset();
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={applying || !certified}
            onClick={() =>
              startApply(async () => {
                const res = await applySyncRun(run.id, certified);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                setRun(res.run ?? run);
                setStage("done");
                toast.success("Import applied");
                router.refresh();
              })
            }
            className="btn btn-primary"
          >
            {applying ? <Spinner /> : <Check size={13} strokeWidth={2.5} />} {applying ? "Applying…" : "Apply changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-800 [[data-theme=dark]_&]:text-emerald-300">
        Done — {run?.stats.new ?? 0} added, {(run?.stats.updated ?? 0) + (run?.stats.restored ?? 0)} updated
        {run?.stats.archived ? `, ${run.stats.archived} archived` : ""}.
      </div>
      {(run?.stats.queued ?? 0) > 0 && (
        <Link href="/people/review" className="btn btn-primary">Review {run?.stats.queued} new contacts</Link>
      )}
      {run && run.warnings.length > 0 && (
        <ul className="space-y-1 text-[12px] text-ink-2">{run.warnings.map((w, i) => <li key={i}>• {w}</li>)}</ul>
      )}
      <button type="button" onClick={reset} className="btn btn-secondary">Import another file</button>
    </div>
  );
}
