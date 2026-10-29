"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Plus, RefreshCw, Sheet, Trash2, Unplug } from "lucide-react";
import { Spinner } from "@/app/components/ui/Spinner";
import { toast } from "@/app/components/ui/toast";
import { MappingStep, RunDiffView } from "@/app/imports/SyncImport";
import { applySyncRun, deleteSyncSource, discardSyncRun } from "@/app/imports/syncActions";
import type { RunSummary } from "@/lib/sync/runs";
import type { ColumnMapping, TableData } from "@/lib/sync/mapping";
import type { SyncStats } from "@/lib/sync/engine";
import {
  disconnectGoogle,
  inspectSheet,
  loadSheetTab,
  saveSheetAndPreview,
  setSheetAutoSync,
  syncSheetNow,
} from "../googleActions";
import { FieldLabel, Panel, Pill, inputCls, useAction } from "./ui";

export type SheetSourceView = {
  id: string;
  name: string;
  tab: string;
  spreadsheetId: string;
  spreadsheetTitle: string;
  autoSync: boolean;
  lastRunAt: string | null;
  lastRunId: string | null;
  lastRunStatus: string | null;
  lastStats: Partial<SyncStats> | null;
  lastError: string | null;
};

type Props = {
  configError: string | null;
  connection: { email: string | null; connectedAt: string } | null;
  sources: SheetSourceView[];
  customFields: { key: string; label: string }[];
};

function when(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type Wizard =
  | { step: "link" }
  | { step: "tab"; spreadsheetId: string; title: string; tabs: { id: number; title: string }[]; gid: number | null; sourceId?: string }
  | {
      step: "map";
      spreadsheetId: string;
      title: string;
      tab: string;
      table: TableData;
      rowCount: number;
      mapping: ColumnMapping;
      name: string;
      sourceId?: string;
    }
  | { step: "preview"; sourceId: string; run: RunSummary };

function AddSheet({
  customFields,
  initial,
  onClose,
}: {
  customFields: { key: string; label: string }[];
  initial?: { sourceId: string; spreadsheetId: string; title: string; tab: string; name: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [wizard, setWizard] = useState<Wizard>({ step: "link" });
  const [url, setUrl] = useState("");
  const { pending, run } = useAction();
  const [busy, setBusy] = useState(false);

  // Editing the mapping of a saved sheet jumps straight to the mapping step
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      const res = await loadSheetTab(initial.spreadsheetId, initial.tab, initial.sourceId);
      if (cancelled) return;
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error);
        onClose();
        return;
      }
      setWizard({
        step: "map",
        spreadsheetId: initial.spreadsheetId,
        title: initial.title,
        tab: initial.tab,
        table: { headers: res.headers, rows: res.sampleRows },
        rowCount: res.rowCount,
        mapping: res.mapping,
        name: initial.name,
        sourceId: initial.sourceId,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function inspect() {
    setBusy(true);
    const res = await inspectSheet(url);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    const first = res.tabs.find((t) => t.id === res.gid) ?? res.tabs[0];
    if (res.tabs.length === 1 || res.gid !== null) {
      await chooseTab(res.spreadsheetId, res.title, first.title);
    } else {
      setWizard({ step: "tab", spreadsheetId: res.spreadsheetId, title: res.title, tabs: res.tabs, gid: res.gid });
    }
  }

  async function chooseTab(spreadsheetId: string, title: string, tab: string) {
    setBusy(true);
    const res = await loadSheetTab(spreadsheetId, tab);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setWizard({
      step: "map",
      spreadsheetId,
      title,
      tab,
      table: { headers: res.headers, rows: res.sampleRows },
      rowCount: res.rowCount,
      mapping: res.mapping,
      name: title,
    });
  }

  if (wizard.step === "link") {
    return (
      <div className="space-y-3">
        <FieldLabel label="Google Sheet link" hint="Open your sheet in Google, click Share and copy the link. Share it with the Google account you connected if it isn't yours.">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className={inputCls} />
        </FieldLabel>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button type="button" disabled={busy || !url.trim()} onClick={inspect} className="btn btn-primary">
            {busy && <Spinner />} Continue
          </button>
        </div>
      </div>
    );
  }

  if (wizard.step === "tab") {
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-ink-2">Which tab in <span className="font-medium text-ink">{wizard.title}</span> has your families?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {wizard.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={busy}
              onClick={() => chooseTab(wizard.spreadsheetId, wizard.title, t.title)}
              className="rounded-xl border border-line bg-canvas px-4 py-3 text-left text-[13px] font-medium text-ink hover:border-line-strong disabled:opacity-50"
            >
              {t.title}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={() => setWizard({ step: "link" })} className="btn btn-ghost">Back</button>
        </div>
      </div>
    );
  }

  if (wizard.step === "map") {
    const w = wizard;
    return (
      <div className="space-y-4">
        <p className="text-[12px] text-ink-2">
          <span className="font-medium text-ink">{w.title}</span> → {w.tab} · {w.rowCount.toLocaleString()} rows. Match each column once — Kesher remembers it for every sync.
        </p>
        <FieldLabel label="Name">
          <input value={w.name} onChange={(e) => setWizard({ ...w, name: e.target.value })} className={inputCls} />
        </FieldLabel>
        <MappingStep table={w.table} mapping={w.mapping} setMapping={(m) => setWizard({ ...w, mapping: m })} customFields={customFields} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await saveSheetAndPreview({
                sourceId: w.sourceId,
                name: w.name,
                spreadsheetId: w.spreadsheetId,
                spreadsheetTitle: w.title,
                tabTitle: w.tab,
                mapping: w.mapping,
              });
              setBusy(false);
              if (!res.ok) return toast.error(res.error);
              setWizard({ step: "preview", sourceId: res.sourceId, run: res.run });
            }}
            className="btn btn-primary"
          >
            {busy && <Spinner />} Preview first sync
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RunDiffView run={wizard.run} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            await discardSyncRun(wizard.run.id);
            onClose();
          }}
          className="btn btn-secondary"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(
              async () => {
                const res = await applySyncRun(wizard.run.id);
                return res.ok ? { ok: true as const } : res;
              },
              "Sheet connected — it will sync nightly",
              () => {
                onClose();
                router.refresh();
              }
            )
          }
          className="btn btn-primary"
        >
          {pending ? <Spinner /> : <Check size={13} strokeWidth={2.5} />} Apply &amp; turn on nightly sync
        </button>
      </div>
    </div>
  );
}

function SheetRow({ s, onEditMapping }: { s: SheetSourceView; onEditMapping: () => void }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [auto, setAuto] = useState(s.autoSync);
  const stats = s.lastStats;
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-3">
        <Sheet size={15} className="mt-0.5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">{s.name}</p>
          <p className="text-[11px] text-ink-3">{s.spreadsheetTitle} → {s.tab}</p>
        </div>
        {s.lastError ? <Pill tone="bad">Last sync failed</Pill> : s.lastRunAt ? <Pill tone="ok">Synced {when(s.lastRunAt)}</Pill> : <Pill tone="muted">Never synced</Pill>}
      </div>
      {s.lastError && <p className="pl-7 text-[12px] text-red-600">{s.lastError}</p>}
      {stats && !s.lastError && (
        <p className="pl-7 text-[12px] tabular-nums text-ink-2">
          {stats.new ?? 0} new{stats.queued ? ` (${stats.queued} to review)` : ""} · {(stats.updated ?? 0) + (stats.restored ?? 0)} updated · {stats.unchanged ?? 0} unchanged
          {stats.missing ? ` · ${stats.missing} missing` : ""}
          {stats.archived ? ` · ${stats.archived} archived` : ""}
          {s.lastRunId && (
            <Link href={`/imports/runs/${s.lastRunId}`} className="ml-2 inline-flex items-center gap-0.5 text-brand hover:underline">
              See changes <ExternalLink size={10} />
            </Link>
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pl-7">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(async () => { const r = await syncSheetNow(s.id); return r.ok ? { ok: true as const, message: "Sync finished" } : r; }, "Sync finished", () => router.refresh())}
          className="btn btn-secondary btn-sm"
        >
          {pending ? <Spinner size={10} /> : <RefreshCw size={11} />} Sync now
        </button>
        <button type="button" onClick={onEditMapping} className="btn btn-ghost btn-sm">Edit columns</button>
        <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-2">
          <input
            type="checkbox"
            checked={auto}
            disabled={pending}
            onChange={(e) => {
              setAuto(e.target.checked);
              run(async () => { const r = await setSheetAutoSync(s.id, e.target.checked); return r.ok ? { ok: true as const } : r; }, e.target.checked ? "Nightly sync on" : "Nightly sync off");
            }}
            className="h-3.5 w-3.5 accent-[var(--app-ink)]"
          />
          Sync every night
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Remove "${s.name}"? Its people stay in your directory but stop being updated by it.`)) {
              run(async () => { const r = await deleteSyncSource(s.id); return r.ok ? { ok: true as const, message: r.message } : r; }, "Sheet removed", () => router.refresh());
            }
          }}
          aria-label={`Remove ${s.name}`}
          className="ml-auto rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-red-600"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}

export function GoogleSheetsSettings({ configError, connection, sources, customFields }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SheetSourceView | null>(null);
  const { pending, run } = useAction();

  // Result of the OAuth round trip (?google=connected | error&msg=…)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const g = sp.get("google");
    if (!g) return;
    if (g === "connected") toast.success("Google connected");
    else toast.error(sp.get("msg") ?? "Couldn't connect Google.");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  }, []);

  return (
    <Panel
      title="Google Sheets"
      description="Keep Kesher in step with a family list you maintain in Google Sheets. Kesher only gets read-only access, syncs every night, and you can sync on demand. Changes are applied with the same rules as an import."
    >
      {configError ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-800 [[data-theme=dark]_&]:text-amber-300">{configError}</p>
      ) : !connection ? (
        <div className="space-y-3">
          <a href="/api/google/oauth/start" className="btn btn-primary">
            <Sheet size={13} /> Connect Google Sheet
          </a>
          <p className="text-[11px] text-ink-3">You&apos;ll be asked to allow read-only access to your spreadsheets. Kesher never changes them.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone="ok">Connected{connection.email ? ` as ${connection.email}` : ""}</Pill>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm("Disconnect Google? Your sheets stop syncing; the people already imported stay.")) {
                  run(async () => { const r = await disconnectGoogle(); return r.ok ? { ok: true as const } : r; }, "Google disconnected", () => router.refresh());
                }
              }}
              className="btn btn-ghost btn-sm"
            >
              <Unplug size={11} /> Disconnect
            </button>
          </div>

          {sources.length > 0 && (
            <ul className="divide-y divide-line">
              {sources.map((s) => <SheetRow key={s.id} s={s} onEditMapping={() => { setAdding(false); setEditing(s); }} />)}
            </ul>
          )}

          {editing ? (
            <div className="rounded-xl border border-line bg-canvas p-4">
              <AddSheet
                key={editing.id}
                customFields={customFields}
                initial={{ sourceId: editing.id, spreadsheetId: editing.spreadsheetId, title: editing.spreadsheetTitle, tab: editing.tab, name: editing.name }}
                onClose={() => setEditing(null)}
              />
            </div>
          ) : adding ? (
            <div className="rounded-xl border border-line bg-canvas p-4">
              <AddSheet customFields={customFields} onClose={() => { setAdding(false); router.refresh(); }} />
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="btn btn-secondary">
              <Plus size={12} strokeWidth={2.5} /> Add a sheet
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}
