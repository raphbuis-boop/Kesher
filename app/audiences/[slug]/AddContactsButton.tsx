"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addContactsToGroup } from "@/app/groups/actions";

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

export function AddContactsButton({
  groupId,
  nonMembers,
}: {
  groupId: string;
  nonMembers: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openModal() {
    setQuery("");
    setSelected(new Set());
    setError(null);
    setOpen(true);
    // focus search after paint
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  const filtered = nonMembers.filter((p) => {
    if (!query.trim()) return true;
    const lq = query.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(lq) ||
      p.last_name.toLowerCase().includes(lq) ||
      (p.email?.toLowerCase().includes(lq) ?? false)
    );
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await addContactsToGroup(groupId, [...selected]);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to add contacts.");
      }
    });
  }

  if (nonMembers.length === 0) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-400 cursor-not-allowed"
        title="All contacts are already in this audience"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Contacts
      </button>
    );
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:border-zinc-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Contacts
      </button>

      {open && (
        <div
          ref={overlayRef}
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
        >
          <div className="flex w-full max-w-md flex-col rounded-xl border border-zinc-200 bg-white shadow-xl max-h-[80vh]">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-900">Add Contacts</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="shrink-0 border-b border-zinc-100 px-5 py-3">
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-400">
                  {query.trim()
                    ? "No contacts match your search."
                    : "All contacts are already in this audience."}
                </p>
              ) : (
                <ul className="divide-y divide-zinc-50">
                  {filtered.map((person) => {
                    const isSelected = selected.has(person.id);
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => toggle(person.id)}
                          className={
                            "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-zinc-50 " +
                            (isSelected ? "bg-zinc-50" : "")
                          }
                        >
                          <div
                            className={
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors " +
                              (isSelected
                                ? "border-zinc-900 bg-zinc-900"
                                : "border-zinc-300 bg-white")
                            }
                          >
                            {isSelected && (
                              <svg
                                className="h-2.5 w-2.5 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-900">
                              {person.first_name} {person.last_name}
                            </p>
                            {person.email && (
                              <p className="truncate text-xs text-zinc-400">{person.email}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-zinc-100 px-5 py-4">
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-400">
                  {selected.size > 0
                    ? `${selected.size} selected`
                    : `${nonMembers.length.toLocaleString()} available`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={selected.size === 0 || isPending}
                    className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Adding…
                      </>
                    ) : selected.size > 0 ? (
                      `Add ${selected.size} Contact${selected.size !== 1 ? "s" : ""}`
                    ) : (
                      "Add Contacts"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
