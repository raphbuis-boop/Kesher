"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X, Loader2 } from "lucide-react";
import { updatePerson, type UpdatePersonState } from "./actions";

export type Tag = {
  id: string;
  name: string;
};

export type PersonData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  grade: string | null;
  graduation_year: number | null;
  organization: string | null;
  notes: string | null;
  currentTagIds: string[];
  currentCategories: string[];
};

const AUDIENCE_OPTIONS = [
  { value: "parent",      label: "Parent"      },
  { value: "student",     label: "Student"     },
  { value: "grandparent", label: "Grandparent" },
  { value: "alumni",      label: "Alumni"      },
  { value: "faculty",     label: "Faculty"     },
  { value: "staff",       label: "Staff"       },
  { value: "board",       label: "Board"       },
  { value: "donor",       label: "Donor"       },
  { value: "prospect",    label: "Prospect"    },
];

const initialState: UpdatePersonState = { success: false, error: null };

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-3 py-2 text-[13px] text-[#0f0f0f] placeholder-[#a1a1aa] outline-none transition-colors focus:border-[#a1a1aa] focus:bg-white disabled:opacity-50";

const labelCls = "block text-[11px] font-medium text-[#71717a] mb-1.5";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-[#f5f5f5] my-5" />;
}

// ─── Form ────────────────────────────────────────────────────────────────────

function EditPersonForm({
  person,
  tags,
  onSuccess,
  onCancel,
}: {
  person: PersonData;
  tags: Tag[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(updatePerson, initialState);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(person.currentCategories);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(person.currentTagIds);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="person_id" value={person.id} />

      {/* ── Basic Information ──────────────────────────────────────────── */}
      <SectionLabel>Basic Information</SectionLabel>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label htmlFor="ep_first_name" className={labelCls}>
            First Name <span className="text-[#d4d4d8]">*</span>
          </label>
          <input
            id="ep_first_name"
            name="first_name"
            type="text"
            required
            defaultValue={person.first_name}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="ep_last_name" className={labelCls}>
            Last Name <span className="text-[#d4d4d8]">*</span>
          </label>
          <input
            id="ep_last_name"
            name="last_name"
            type="text"
            required
            defaultValue={person.last_name}
            disabled={isPending}
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label htmlFor="ep_email" className={labelCls}>Email</label>
          <input
            id="ep_email"
            name="email"
            type="email"
            defaultValue={person.email ?? ""}
            disabled={isPending}
            className={inputCls}
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <label htmlFor="ep_phone" className={labelCls}>Phone</label>
          <input
            id="ep_phone"
            name="phone"
            type="tel"
            defaultValue={person.phone ?? ""}
            disabled={isPending}
            className={inputCls}
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ep_whatsapp" className={labelCls}>WhatsApp</label>
          <input
            id="ep_whatsapp"
            name="whatsapp"
            type="tel"
            defaultValue={person.whatsapp ?? ""}
            disabled={isPending}
            className={inputCls}
            placeholder="+1 555 000 0000"
          />
        </div>
        <div>
          <label htmlFor="ep_address" className={labelCls}>Address</label>
          <input
            id="ep_address"
            name="address"
            type="text"
            defaultValue={person.address ?? ""}
            disabled={isPending}
            className={inputCls}
            placeholder="123 Main St"
          />
        </div>
      </div>

      <Divider />

      {/* ── School Information ─────────────────────────────────────────── */}
      <SectionLabel>School Information</SectionLabel>

      <div className="mb-3">
        <p className={labelCls}>Category</p>
        <div className="flex flex-wrap gap-1.5">
          {AUDIENCE_OPTIONS.map(({ value, label }) => {
            const selected = selectedCategories.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleCategory(value)}
                disabled={isPending}
                className={[
                  "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                  selected
                    ? "bg-[#0f0f0f] text-white"
                    : "bg-[#f5f5f5] text-[#71717a] hover:bg-[#e7e7e7] hover:text-[#0f0f0f]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
        {selectedCategories.map((c) => (
          <input key={c} type="hidden" name="categories" value={c} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label htmlFor="ep_grade" className={labelCls}>Grade</label>
          <input
            id="ep_grade"
            name="grade"
            type="text"
            defaultValue={person.grade ?? ""}
            disabled={isPending}
            className={inputCls}
            placeholder="e.g. K, 3, 11"
          />
        </div>
        <div>
          <label htmlFor="ep_graduation_year" className={labelCls}>Graduation Year</label>
          <input
            id="ep_graduation_year"
            name="graduation_year"
            type="number"
            min={1900}
            max={2100}
            defaultValue={person.graduation_year ?? ""}
            disabled={isPending}
            className={inputCls}
            placeholder="2024"
          />
        </div>
      </div>

      <div>
        <label htmlFor="ep_organization" className={labelCls}>Organization</label>
        <input
          id="ep_organization"
          name="organization"
          type="text"
          defaultValue={person.organization ?? ""}
          disabled={isPending}
          className={inputCls}
          placeholder="School name or company"
        />
      </div>

      {/* ── Tags ──────────────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <>
          <Divider />
          <SectionLabel>Tags</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  disabled={isPending}
                  className={[
                    "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                    selected
                      ? "bg-[#0f0f0f] text-white"
                      : "bg-[#f5f5f5] text-[#71717a] hover:bg-[#e7e7e7]",
                  ].join(" ")}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          {selectedTagIds.map((id) => (
            <input key={id} type="hidden" name="tag_ids" value={id} />
          ))}
        </>
      )}

      {/* ── Notes ─────────────────────────────────────────────────────── */}
      <Divider />
      <label htmlFor="ep_notes" className="mb-3 block text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Notes</label>
      <textarea
        id="ep_notes"
        name="notes"
        rows={3}
        defaultValue={person.notes ?? ""}
        disabled={isPending}
        className={[
          inputCls,
          "resize-none",
        ].join(" ")}
        placeholder="Add any notes about this person…"
      />

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {state.error && (
        <div className="mt-5 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
          {state.error}
        </div>
      )}

      {/* ── Footer buttons ────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#f5f5f5] pt-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-4 py-1.5 text-[12px] font-medium text-white hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Button + Modal ───────────────────────────────────────────────────────────

export function EditPersonButton({
  person,
  tags,
}: {
  person: PersonData;
  tags: Tag[];
}) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);

    // Scroll lock without layout shift
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.top = `-${scrollY}px`;
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      document.body.style.top = "";
      document.body.style.position = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0f0f0f] hover:bg-[#fafafa] hover:border-[#d4d4d8]"
      >
        <Pencil size={12} strokeWidth={2} />
        Edit
      </button>

      {open && createPortal(
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          className="animate-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 p-4"
        >
          <div
            className="animate-fade-up w-full max-w-[520px] rounded-xl border border-[#e7e7e7] bg-white shadow-2xl shadow-black/10"
            style={{
              display: "grid",
              gridTemplateRows: "auto minmax(0,1fr)",
              maxHeight: "min(85dvh, 900px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#f0f0f0] px-6 py-4">
              <div>
                <h2 className="text-[13px] font-semibold text-[#0f0f0f]">Edit Contact</h2>
                <p className="mt-px text-[11px] text-[#a1a1aa]">
                  {person.first_name} {person.last_name}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#f5f5f5] hover:text-[#71717a]"
                aria-label="Close"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5">
              <EditPersonForm
                person={person}
                tags={tags}
                onSuccess={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
