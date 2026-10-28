"use client";

import { useEffect, useId, useRef, useState } from "react";

export type PickerPerson = { id: string; first_name: string; last_name: string };

/** Type-to-search combobox over a list of people; calls onSelect with the chosen person. */
export function PersonPicker({
  people,
  onSelect,
  disabled,
  placeholder = "Search by name…",
}: {
  people: PickerPerson[];
  onSelect: (p: PickerPerson) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  const q = query.trim().toLowerCase();
  const results = q
    ? people.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)).slice(0, 8)
    : [];

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => q && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink placeholder-ink-3 outline-none focus:border-ink-3 focus:bg-card disabled:opacity-50"
      />
      {open && results.length > 0 && (
        <div id={listId} role="listbox" className="animate-pop-in absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-card shadow-pop">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setQuery("");
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-canvas"
            >
              {p.first_name} {p.last_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
