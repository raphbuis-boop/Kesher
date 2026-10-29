"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { deleteSyncSource, renameSyncSource } from "./syncActions";

/** Rename / remove a saved list (its people stay in the directory). */
export function SourceActions({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await renameSyncSource(id, value);
            if (res.ok) {
              toast.success("Renamed");
              setEditing(false);
            } else toast.error(res.error);
          });
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40 rounded-md border border-line bg-canvas px-2 py-1 text-[12px] text-ink outline-none focus:border-ink-3"
          autoFocus
        />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">{pending ? <Spinner size={10} /> : "Save"}</button>
        <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">Cancel</button>
      </form>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={() => setEditing(true)} aria-label={`Rename ${name}`} className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-ink">
        <Pencil size={12} />
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${name}`}
        onClick={() => {
          if (!confirm(`Remove "${name}"? Its people stay in your directory but stop being updated by it.`)) return;
          start(async () => {
            const res = await deleteSyncSource(id);
            if (res.ok) toast.success(res.message ?? "Removed");
            else toast.error(res.error);
          });
        }}
        className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-red-600"
      >
        {pending ? <Spinner size={11} /> : <Trash2 size={12} />}
      </button>
    </div>
  );
}
