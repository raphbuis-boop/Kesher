"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Loader2 } from "lucide-react";
import { useDialogFocus } from "@/app/components/useDialogFocus";
import { addPerson, type AddPersonState } from "./actions";

export type Tag = {
  id: string;
  name: string;
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

const initialState: AddPersonState = { success: false, error: null };

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-border-input bg-background px-3 py-2 text-[13px] text-text-primary placeholder-text-subtle transition-colors focus:border-focus-ring focus:bg-surface disabled:opacity-50";

const labelCls = "block text-[11px] font-medium text-text-muted mb-1.5";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="border-t border-border-subtle my-5" />;
}

// ─── Form ────────────────────────────────────────────────────────────────────

function AddPersonForm({
  tags,
  defaultCategories,
  onSuccess,
  onCancel,
}: {
  tags: Tag[];
  defaultCategories: string[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(addPerson, initialState);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(defaultCategories);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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

      {/* ── Basic Information ──────────────────────────────────────────── */}
      <SectionLabel>Basic Information</SectionLabel>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label htmlFor="ap_first_name" className={labelCls}>
            First Name <span aria-hidden className="text-text-subtle">*</span>
          </label>
          <input
            id="ap_first_name"
            name="first_name"
            type="text"
            required
            autoComplete="given-name"
            disabled={isPending}
            className={inputCls}
            placeholder="Jane"
          />
        </div>
        <div>
          <label htmlFor="ap_last_name" className={labelCls}>
            Last Name <span aria-hidden className="text-text-subtle">*</span>
          </label>
          <input
            id="ap_last_name"
            name="last_name"
            type="text"
            required
            autoComplete="family-name"
            disabled={isPending}
            className={inputCls}
            placeholder="Smith"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ap_email" className={labelCls}>Email</label>
          <input
            id="ap_email"
            name="email"
            type="email"
            autoComplete="email"
            disabled={isPending}
            className={inputCls}
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <label htmlFor="ap_phone" className={labelCls}>Phone</label>
          <input
            id="ap_phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={isPending}
            className={inputCls}
            placeholder="+1 555 000 0000"
          />
        </div>
      </div>

      <Divider />

      {/* ── School Information ─────────────────────────────────────────── */}
      <SectionLabel>School Information</SectionLabel>

      <div className="mb-3">
        <p id="category-label" className={labelCls}>Category</p>
        <div role="group" aria-labelledby="category-label" className="flex flex-wrap gap-1.5">
          {AUDIENCE_OPTIONS.map(({ value, label }) => {
            const selected = selectedCategories.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleCategory(value)}
                aria-pressed={selected}
                disabled={isPending}
                className={[
                  "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                  selected
                    ? "bg-primary text-primary-fg"
                    : "bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text-primary",
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

      <div>
        <label htmlFor="ap_grade" className={labelCls}>Grade</label>
        <input
          id="ap_grade"
          name="grade"
          type="text"
          disabled={isPending}
          className={inputCls}
          placeholder="e.g. K, 3, 11"
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
                  aria-pressed={selected}
                  disabled={isPending}
                  className={[
                    "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50",
                    selected
                      ? "bg-primary text-primary-fg"
                      : "bg-surface-2 text-text-muted hover:bg-surface-3",
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

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {state.error && (
        <div role="alert" className="mt-5 rounded-lg border border-danger-border bg-danger-tint px-3 py-2.5 text-[12px] text-danger">
          {state.error}
        </div>
      )}

      {/* ── Footer buttons ────────────────────────────────────────────── */}
      <div className="mt-6 flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-text-muted hover:bg-surface-2 hover:text-text-primary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-medium text-primary-fg hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save Contact"
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Button + Modal ───────────────────────────────────────────────────────────

export function AddPersonButton({
  tags,
  defaultCategories = [],
  variant = "primary",
}: {
  tags: Tag[];
  defaultCategories?: string[];
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);

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
        type="button"
        onClick={() => setOpen(true)}
        className={
          variant === "primary"
            ? "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:bg-primary-hover"
            : "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-primary hover:border-border-strong hover:bg-surface-hover"
        }
      >
        <Plus aria-hidden size={13} strokeWidth={2} />
        Add Contact
      </button>

      {open && createPortal(
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          className="animate-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-overlay p-4"
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-person-title"
            className="animate-fade-up w-full max-w-[480px] rounded-xl border border-border bg-surface shadow-2xl shadow-black/10"
            style={{
              display: "grid",
              gridTemplateRows: "auto minmax(0,1fr)",
              maxHeight: "min(85dvh, 900px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
              <div>
                <h2 id="add-person-title" className="text-[13px] font-semibold text-text-primary">Add Contact</h2>
                <p className="mt-px text-[11px] text-text-subtle">Add a new contact to the directory.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-text-subtle hover:bg-surface-2 hover:text-text-muted"
                aria-label="Close"
              >
                <X aria-hidden size={15} strokeWidth={1.75} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-5">
              <AddPersonForm
                tags={tags}
                defaultCategories={defaultCategories}
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
