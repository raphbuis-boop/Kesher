"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Home, Trash2, Pencil, X } from "lucide-react";
import { toast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { PersonPicker, type PickerPerson } from "@/app/components/ui/PersonPicker";
import { RELATIONSHIPS, RELATIONSHIP_LABELS, type Family, type FamilyLink } from "@/lib/family";
import type { CustomFieldDef } from "@/lib/customFields";
import { LANGUAGES, type ContactPreferences } from "@/lib/preferences";
import {
  linkFamilyMember,
  removeFamilyLink,
  saveCustomFieldValues,
  saveHousehold,
  savePreferences,
  updateFamilyLink,
  type FamilyResult,
} from "./familyActions";

const inputCls =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink placeholder-ink-3 outline-none focus:border-ink-3 focus:bg-card disabled:opacity-50";

function useRun() {
  const [pending, start] = useTransition();
  function run(fn: () => Promise<FamilyResult>, success: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        after?.();
      } else toast.error(res.error);
    });
  }
  return { pending, run };
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-line-strong accent-[var(--app-ink)]"
      />
      {label}
    </label>
  );
}

// ─── Family ───────────────────────────────────────────────────────────────────

function LinkRow({ link }: { link: FamilyLink }) {
  const { pending, run } = useRun();
  const p = link.person;
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={`/people/${p.id}`} className="text-[13px] font-medium text-ink hover:text-ink-2">
          {p.first_name} {p.last_name}
        </Link>
        <p className="text-[11px] text-ink-3">
          {RELATIONSHIP_LABELS[link.relationship] ?? link.relationship}
          {p.grade ? ` · Grade ${p.grade}` : ""}
          {p.status !== "active" ? ` · ${p.status}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          label="Custodial"
          checked={link.custodial}
          disabled={pending}
          onChange={(v) => run(() => updateFamilyLink(link.id, { custodial: v }), "Saved")}
        />
        <Toggle
          label="Receives messages"
          checked={link.receives_messages}
          disabled={pending}
          onChange={(v) => run(() => updateFamilyLink(link.id, { receives_messages: v }), "Saved")}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removeFamilyLink(link.id), "Link removed")}
          aria-label={`Unlink ${p.first_name}`}
          className="rounded-md p-1 text-ink-3 hover:bg-muted hover:text-red-600"
        >
          {pending ? <Spinner size={11} /> : <Trash2 size={12} strokeWidth={2} />}
        </button>
      </div>
    </li>
  );
}

function AddLink({ personId, mode, people }: { personId: string; mode: "guardian" | "student"; people: PickerPerson[] }) {
  const [relationship, setRelationship] = useState<string>("parent");
  const { pending, run } = useRun();
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px]">
      <PersonPicker
        people={people}
        disabled={pending}
        placeholder={mode === "guardian" ? "Add a parent or guardian…" : "Add a child…"}
        onSelect={(p) =>
          run(
            () =>
              mode === "guardian"
                ? linkFamilyMember(p.id, personId, relationship)
                : linkFamilyMember(personId, p.id, relationship),
            `Linked ${p.first_name}`
          )
        }
      />
      <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls} aria-label="Relationship">
        {RELATIONSHIPS.map((r) => (
          <option key={r} value={r}>{RELATIONSHIP_LABELS[r]}</option>
        ))}
      </select>
    </div>
  );
}

function HouseholdEditor({ personId, family }: { personId: string; family: Family }) {
  const hh = family.household;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(hh?.name ?? "");
  const [address, setAddress] = useState(hh?.address ?? "");
  const { pending, run } = useRun();

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Home size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink">{hh ? hh.name || "Unnamed household" : "No household"}</p>
            {hh?.address && <p className="text-[11px] text-ink-3">{hh.address}</p>}
            {hh && hh.members.length > 0 && (
              <p className="mt-1 text-[11px] text-ink-2">
                Also in this household:{" "}
                {hh.members.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ", "}
                    <Link href={`/people/${m.id}`} className="hover:text-ink">{m.first_name} {m.last_name}</Link>
                  </span>
                ))}
              </p>
            )}
            {hh?.source_id && <p className="mt-1 text-[10px] text-ink-3">Family ID {hh.source_id}</p>}
          </div>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost btn-sm">
          <Pencil size={11} strokeWidth={2} /> {hh ? "Edit" : "Create"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cohen family" className={inputCls} aria-label="Household name" />
      <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className={inputCls} aria-label="Household address" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm"><X size={11} /> Cancel</button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => saveHousehold(personId, name, address), "Household saved", () => setEditing(false))}
          className="btn btn-primary btn-sm"
        >
          {pending && <Spinner size={10} />} Save
        </button>
      </div>
    </div>
  );
}

export function FamilyPanel({
  personId,
  isStudent,
  family,
  people,
}: {
  personId: string;
  isStudent: boolean;
  family: Family;
  people: PickerPerson[];
}) {
  // Students show their guardians; anyone with children shows them; a parent
  // with no links yet gets the "add a child" picker.
  const showGuardians = isStudent || family.guardians.length > 0;
  const showStudents = !isStudent || family.students.length > 0;

  return (
    <div className="space-y-5">
      <HouseholdEditor personId={personId} family={family} />

      {showGuardians && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Parents &amp; guardians</p>
          {family.guardians.length > 0 ? (
            <ul className="divide-y divide-muted">{family.guardians.map((l) => <LinkRow key={l.id} link={l} />)}</ul>
          ) : (
            <p className="text-[12px] text-ink-3">No guardians linked — messages to this student&apos;s family go nowhere until one is added.</p>
          )}
          <AddLink personId={personId} mode="guardian" people={people} />
        </div>
      )}

      {showStudents && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Children</p>
          {family.students.length > 0 ? (
            <ul className="divide-y divide-muted">{family.students.map((l) => <LinkRow key={l.id} link={l} />)}</ul>
          ) : (
            <p className="text-[12px] text-ink-3">No children linked.</p>
          )}
          <AddLink personId={personId} mode="student" people={people} />
        </div>
      )}
    </div>
  );
}

// ─── Custom fields ────────────────────────────────────────────────────────────

export function CustomFieldsPanel({
  personId,
  defs,
  values,
}: {
  personId: string;
  defs: CustomFieldDef[];
  values: Record<string, unknown>;
}) {
  const initial = Object.fromEntries(defs.map((d) => [d.key, values[d.key] == null ? "" : String(values[d.key])]));
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [editing, setEditing] = useState(false);
  const { pending, run } = useRun();

  if (defs.length === 0) {
    return (
      <p className="text-[12px] text-ink-3">
        No custom fields yet. Add fields like Class, Division or Bus route in{" "}
        <Link href="/settings#data" className="text-ink-2 underline underline-offset-2 hover:text-ink">Settings → Data</Link>.
      </p>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4">
          {defs.map((d) => (
            <div key={d.id}>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{d.label}</dt>
              <dd className="mt-1 text-[13px] text-ink">{initial[d.key] || <span className="text-line-strong">—</span>}</dd>
            </div>
          ))}
        </dl>
        <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost btn-sm">
          <Pencil size={11} strokeWidth={2} /> Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {defs.map((d) => (
          <label key={d.id} className="block">
            <span className="mb-1 block text-[11px] font-medium text-ink-2">{d.label}</span>
            {d.field_type === "select" && d.options.length > 0 ? (
              <select value={draft[d.key]} onChange={(e) => setDraft({ ...draft, [d.key]: e.target.value })} className={inputCls}>
                <option value="">—</option>
                {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={d.field_type === "number" ? "number" : "text"}
                value={draft[d.key]}
                onChange={(e) => setDraft({ ...draft, [d.key]: e.target.value })}
                className={inputCls}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setDraft(initial); setEditing(false); }} className="btn btn-ghost btn-sm">Cancel</button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => saveCustomFieldValues(personId, draft), "Fields saved", () => setEditing(false))}
          className="btn btn-primary btn-sm"
        >
          {pending && <Spinner size={10} />} Save
        </button>
      </div>
    </div>
  );
}

// ─── Kesher preferences ───────────────────────────────────────────────────────

export function PreferencesPanel({ personId, prefs }: { personId: string; prefs: ContactPreferences }) {
  const [p, setP] = useState(prefs);
  const { pending, run } = useRun();
  const dirty = JSON.stringify(p) !== JSON.stringify(prefs);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-2">WhatsApp opt-in</span>
          <select
            value={p.whatsapp_opt_in === null ? "" : p.whatsapp_opt_in ? "yes" : "no"}
            onChange={(e) => setP({ ...p, whatsapp_opt_in: e.target.value === "" ? null : e.target.value === "yes" })}
            className={inputCls}
          >
            <option value="">Not asked</option>
            <option value="yes">Opted in</option>
            <option value="no">Declined</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-2">Language</span>
          <select value={p.language ?? ""} onChange={(e) => setP({ ...p, language: e.target.value || null })} className={inputCls}>
            <option value="">Not set</option>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-2">Preferred channel</span>
          <select
            value={p.preferred_channel ?? ""}
            onChange={(e) => setP({ ...p, preferred_channel: (e.target.value || null) as ContactPreferences["preferred_channel"] })}
            className={inputCls}
          >
            <option value="">School default</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">Text (SMS)</option>
            <option value="email">Email</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Toggle label="Email" checked={p.email_enabled} onChange={(v) => setP({ ...p, email_enabled: v })} />
        <Toggle label="Text (SMS)" checked={p.sms_enabled} onChange={(v) => setP({ ...p, sms_enabled: v })} />
        <Toggle label="WhatsApp" checked={p.whatsapp_enabled} onChange={(v) => setP({ ...p, whatsapp_enabled: v })} />
        <Toggle label="Emergency messages only" checked={p.emergency_only} onChange={(v) => setP({ ...p, emergency_only: v })} />
      </div>
      {p.sms_consent_at && (
        <p className="text-[11px] text-ink-3">
          SMS consent recorded {new Date(p.sms_consent_at).toLocaleString()}
          {p.consent_source ? ` via ${p.consent_source}` : ""}.
        </p>
      )}
      {dirty && (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setP(prefs)} className="btn btn-ghost btn-sm">Reset</button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  savePreferences(personId, {
                    whatsapp_opt_in: p.whatsapp_opt_in,
                    language: p.language,
                    email_enabled: p.email_enabled,
                    sms_enabled: p.sms_enabled,
                    whatsapp_enabled: p.whatsapp_enabled,
                    preferred_channel: p.preferred_channel,
                    emergency_only: p.emergency_only,
                  }),
                "Preferences saved"
              )
            }
            className="btn btn-primary btn-sm"
          >
            {pending && <Spinner size={10} />} Save preferences
          </button>
        </div>
      )}
    </div>
  );
}
