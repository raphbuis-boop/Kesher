"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addRelationship, type AddRelationshipState } from "./actions";

export type PersonOption = {
  id: string;
  first_name: string;
  last_name: string;
};

const RELATIONSHIP_TYPES = [
  "Parent",
  "Mother",
  "Father",
  "Grandparent",
  "Student",
  "Sibling",
  "Spouse",
  "Child",
  "Faculty",
] as const;

const initialState: AddRelationshipState = { success: false, error: null };

// ─── Person search combobox ───────────────────────────────────────────────────

function PersonSearch({
  allPeople,
  isPending,
}: {
  allPeople: PersonOption[];
  isPending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const results =
    query.trim().length > 0
      ? allPeople
          .filter((p) =>
            `${p.first_name} ${p.last_name}`
              .toLowerCase()
              .includes(query.toLowerCase())
          )
          .slice(0, 8)
      : [];

  function select(p: PersonOption) {
    setSelectedId(p.id);
    setQuery(`${p.first_name} ${p.last_name}`);
    setOpen(false);
  }

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const listboxId = "relationship-person-listbox";

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-haspopup="listbox"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim()) setOpen(true);
        }}
        placeholder="Search by name…"
        disabled={isPending}
        autoComplete="off"
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400 disabled:opacity-50"
      />
      {/* Carries the resolved person ID into the form */}
      <input type="hidden" name="related_person_id" value={selectedId} />

      {open && results.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 right-0 z-10 mt-1 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          {results.map((p) => (
            <button
              key={p.id}
              role="option"
              aria-selected={selectedId === p.id}
              type="button"
              onMouseDown={(e) => {
                // prevent blur from firing before click
                e.preventDefault();
              }}
              onClick={() => select(p)}
              className="w-full px-3 py-2.5 text-left text-sm text-zinc-900 hover:bg-zinc-50 transition-colors"
            >
              {p.first_name} {p.last_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

function AddRelationshipForm({
  personId,
  allPeople,
  onSuccess,
}: {
  personId: string;
  allPeople: PersonOption[];
  onSuccess: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    addRelationship,
    initialState
  );

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="person_id" value={personId} />

      <div className="space-y-4">
        <div>
          <label
            htmlFor="relationship_type"
            className="block text-sm font-medium text-zinc-700 mb-1"
          >
            Relationship Type <span className="text-red-500">*</span>
          </label>
          <select
            id="relationship_type"
            name="relationship_type"
            defaultValue=""
            required
            disabled={isPending}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 disabled:opacity-50"
          >
            <option value="" disabled>
              Select type…
            </option>
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Related Person <span className="text-red-500">*</span>
          </label>
          <PersonSearch allPeople={allPeople} isPending={isPending} />
        </div>

        {state.error && (
          <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {state.error}
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <svg
                className="h-3.5 w-3.5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Saving…
            </>
          ) : (
            "Add Relationship"
          )}
        </button>
      </div>
    </form>
  );
}

// ─── Button + modal ───────────────────────────────────────────────────────────

export function AddRelationshipButton({
  personId,
  allPeople,
}: {
  personId: string;
  allPeople: PersonOption[];
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
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:border-zinc-300"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        Add Relationship
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Add Relationship
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Connect this person to someone else in the directory.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Close"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">
              {/* Form unmounts on close, so state resets on reopen */}
              <AddRelationshipForm
                personId={personId}
                allPeople={allPeople}
                onSuccess={() => setOpen(false)}
              />
            </div>

            <div className="border-t border-zinc-100 px-6 py-3">
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
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
