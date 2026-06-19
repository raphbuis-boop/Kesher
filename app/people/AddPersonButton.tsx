"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPerson, type AddPersonState } from "./actions";

export type Tag = {
  id: string;
  name: string;
};

const AUDIENCE_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
  { value: "grandparent", label: "Grandparent" },
  { value: "alumni", label: "Alumni" },
  { value: "faculty", label: "Faculty" },
  { value: "staff", label: "Staff" },
  { value: "board", label: "Board" },
  { value: "donor", label: "Donor" },
  { value: "prospect", label: "Prospect" },
];

const initialState: AddPersonState = { success: false, error: null };

function AddPersonForm({
  tags,
  defaultCategories,
  onSuccess,
}: {
  tags: Tag[];
  defaultCategories: string[];
  onSuccess: () => void;
}) {
  const [state, formAction, isPending] = useActionState(addPerson, initialState);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(defaultCategories);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
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
      {/* Name */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label
            htmlFor="ap_first_name"
            className="block text-xs font-medium text-zinc-600 mb-1"
          >
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="ap_first_name"
            name="first_name"
            type="text"
            required
            autoComplete="given-name"
            disabled={isPending}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 disabled:opacity-50"
            placeholder="Jane"
          />
        </div>
        <div>
          <label
            htmlFor="ap_last_name"
            className="block text-xs font-medium text-zinc-600 mb-1"
          >
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="ap_last_name"
            name="last_name"
            type="text"
            required
            autoComplete="family-name"
            disabled={isPending}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 disabled:opacity-50"
            placeholder="Smith"
          />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label
            htmlFor="ap_email"
            className="block text-xs font-medium text-zinc-600 mb-1"
          >
            Email
          </label>
          <input
            id="ap_email"
            name="email"
            type="email"
            autoComplete="email"
            disabled={isPending}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 disabled:opacity-50"
            placeholder="jane@example.com"
          />
        </div>
        <div>
          <label
            htmlFor="ap_phone"
            className="block text-xs font-medium text-zinc-600 mb-1"
          >
            Phone
          </label>
          <input
            id="ap_phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={isPending}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 disabled:opacity-50"
            placeholder="+1 (555) 000-0000"
          />
        </div>
      </div>

      {/* Grade */}
      <div className="mb-4">
        <label
          htmlFor="ap_grade"
          className="block text-xs font-medium text-zinc-600 mb-1"
        >
          Grade
        </label>
        <input
          id="ap_grade"
          name="grade"
          type="text"
          disabled={isPending}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 disabled:opacity-50"
          placeholder="e.g. K, 3, 11"
        />
      </div>

      {/* Audiences */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-600 mb-2">
          Audiences
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AUDIENCE_OPTIONS.map(({ value, label }) => {
            const selected = selectedCategories.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleCategory(value)}
                disabled={isPending}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
                  (selected
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100")
                }
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

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-zinc-600 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  disabled={isPending}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
                    (selected
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          {selectedTagIds.map((id) => (
            <input key={id} type="hidden" name="tag_ids" value={id} />
          ))}
        </div>
      )}

      {state.error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            "Save"
          )}
        </button>
      </div>
    </form>
  );
}

export function AddPersonButton({
  tags,
  defaultCategories = [],
}: {
  tags: Tag[];
  defaultCategories?: string[];
}) {
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

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Contact
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Add Contact</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Add a new contact to the directory.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <AddPersonForm
                tags={tags}
                defaultCategories={defaultCategories}
                onSuccess={() => setOpen(false)}
              />
            </div>

            <div className="flex-shrink-0 border-t border-zinc-100 px-6 py-3">
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
