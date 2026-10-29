"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Spinner } from "@/app/components/ui/Spinner";
import { SUGGESTED_FIELDS, type CustomFieldDef } from "@/lib/customFields";
import { addCustomField, deleteCustomField, updateCustomField } from "../dataActions";
import { FieldLabel, Panel, inputCls, useAction } from "./ui";

const APPLIES: Record<CustomFieldDef["applies_to"], string> = {
  student: "Students",
  guardian: "Parents",
  any: "Everyone",
};

function FieldRow({ def }: { def: CustomFieldDef }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(def.label);
  const [options, setOptions] = useState(def.options.join(", "));
  const { pending, run } = useAction();

  if (editing) {
    return (
      <li className="space-y-2 py-3 first:pt-0 last:pb-0">
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} aria-label="Field name" />
          {def.field_type === "select" && (
            <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options, comma separated" className={inputCls} aria-label="Options" />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          <button
            type="button"
            disabled={pending}
            className="btn btn-primary btn-sm"
            onClick={() => run(() => updateCustomField(def.id, { label, options: options.split(",") }), "Field saved", () => setEditing(false))}
          >
            {pending && <Spinner size={10} />} Save
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-ink">{def.label}</p>
        <p className="text-[11px] text-ink-3">
          {APPLIES[def.applies_to]} · {def.field_type === "select" ? `Choice: ${def.options.join(", ") || "—"}` : def.field_type}
          <span className="ml-1 font-mono text-[10.5px]">{`{{${def.key}}}`}</span>
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-ink" aria-label={`Edit ${def.label}`}>
        <Pencil size={12} strokeWidth={2} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Remove "${def.label}"? Values stay saved and come back if you add the field again.`)) {
            run(() => deleteCustomField(def.id), "Field removed");
          }
        }}
        className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-red-600"
        aria-label={`Remove ${def.label}`}
      >
        {pending ? <Spinner size={11} /> : <Trash2 size={12} strokeWidth={2} />}
      </button>
    </li>
  );
}

export function CustomFieldsSettings({ defs }: { defs: CustomFieldDef[] }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldDef["field_type"]>("text");
  const [applies, setApplies] = useState<CustomFieldDef["applies_to"]>("student");
  const [options, setOptions] = useState("");
  const { pending, run } = useAction();
  const existing = new Set(defs.map((d) => d.label.toLowerCase()));
  const suggestions = SUGGESTED_FIELDS.filter((s) => !existing.has(s.label.toLowerCase()));

  function add(l = label, a = applies, t = type, o = options) {
    run(
      () => addCustomField({ label: l, field_type: t, applies_to: a, options: o.split(",") }),
      `Added "${l}"`,
      () => {
        setLabel("");
        setOptions("");
      }
    );
  }

  return (
    <Panel
      title="Custom fields"
      description="Extra details about each person — class, division, team, bus route. Map them from your spreadsheet or school system, filter smart audiences on them, and use them in messages."
    >
      {defs.length > 0 && <ul className="mb-5 divide-y divide-line">{defs.map((d) => <FieldRow key={d.id} def={d} />)}</ul>}

      {suggestions.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-3">Quick add:</span>
          {suggestions.map((s) => (
            <button key={s.label} type="button" disabled={pending} onClick={() => add(s.label, s.applies_to, "text", "")} className="btn btn-secondary btn-sm">
              <Plus size={10} strokeWidth={2.5} /> {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_130px_130px]">
        <FieldLabel label="New field">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Shiur" className={inputCls} />
        </FieldLabel>
        <FieldLabel label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as CustomFieldDef["field_type"])} className={inputCls}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Choice list</option>
          </select>
        </FieldLabel>
        <FieldLabel label="For">
          <select value={applies} onChange={(e) => setApplies(e.target.value as CustomFieldDef["applies_to"])} className={inputCls}>
            <option value="student">Students</option>
            <option value="guardian">Parents</option>
            <option value="any">Everyone</option>
          </select>
        </FieldLabel>
      </div>
      {type === "select" && (
        <div className="mt-3">
          <FieldLabel label="Choices" hint="Comma separated, e.g. Boys, Girls">
            <input value={options} onChange={(e) => setOptions(e.target.value)} className={inputCls} />
          </FieldLabel>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button type="button" disabled={pending || !label.trim()} onClick={() => add()} className="btn btn-primary">
          {pending ? <Spinner /> : <Plus size={12} strokeWidth={2.5} />} Add field
        </button>
      </div>
    </Panel>
  );
}
