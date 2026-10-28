"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Search, X, Loader2, Check } from "lucide-react";
import { addContactsToGroup } from "@/app/groups/actions";
import { toast } from "@/app/components/ui/toast";

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

function initials(p: Person) {
  return (p.first_name[0] ?? "") + (p.last_name[0] ?? "");
}

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

  // Keyboard handler + body scroll lock
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);

    // Prevent page scroll without causing layout shift
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

  function openModal() {
    setQuery("");
    setSelected(new Set());
    setError(null);
    setOpen(true);
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

  // Select All selects only the currently filtered results
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function handleSelectAll() {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  function handleClearSelection() {
    setSelected(new Set());
  }

  function handleAdd() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await addContactsToGroup(groupId, [...selected]);
      if (result.success) {
        setOpen(false);
        toast.success(`Added ${selected.size} contact${selected.size === 1 ? "" : "s"}`);
        router.refresh();
      } else {
        setError(result.error ?? "Failed to add contacts.");
        toast.error(result.error ?? "Failed to add contacts.");
      }
    });
  }

  if (nonMembers.length === 0) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-ink-3 cursor-not-allowed"
        title="All contacts are already in this audience"
      >
        <Plus size={13} strokeWidth={2} />
        Add Contacts
      </button>
    );
  }

  return (
    <>
      <button
        onClick={openModal}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-canvas hover:border-line-strong"
      >
        <Plus size={13} strokeWidth={2} />
        Add Contacts
      </button>

      {open && createPortal(
        <div
          ref={overlayRef}
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
          className="animate-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 p-4"
        >
          <div
            className="animate-pop-in w-full max-w-[740px] rounded-xl border border-line bg-card shadow-pop"
            style={{
              display: "grid",
              gridTemplateRows: "auto minmax(0,1fr) auto",
              maxHeight: "min(85dvh, 900px)",
            }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between border-b border-muted-2 px-6 py-4">
              <div>
                <h2 className="text-[13px] font-semibold text-ink">
                  Add Contacts
                  {selected.size > 0 && (
                    <span className="ml-2 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-medium text-brand">
                      {selected.size} selected
                    </span>
                  )}
                </h2>
                <p className="mt-px text-[11px] text-ink-3">
                  {nonMembers.length.toLocaleString()} contacts available to add
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-ink-2"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
            </div>

            {/* ── Middle: search + scrollable list (single grid row) ── */}
            <div className="flex min-h-0 flex-col">
            {/* Search + bulk actions */}
            <div className="shrink-0 border-b border-muted-2 px-6 py-3 space-y-2.5">
              <div className="relative">
                <Search
                  size={13}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full rounded-lg border border-line bg-canvas py-2 pl-8 pr-3 text-[13px] text-ink placeholder-ink-3 outline-none focus:border-ink-3 focus:bg-card"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink-2"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {filtered.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[11px] font-medium text-brand hover:text-brand-strong"
                  >
                    {allFilteredSelected ? "Deselect All" : "Select All"}
                    {!allFilteredSelected && filtered.length < nonMembers.length && ` (${filtered.length})`}
                  </button>
                  {selected.size > 0 && (
                    <>
                      <span className="text-line">·</span>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="text-[11px] font-medium text-ink-2 hover:text-ink"
                      >
                        Clear Selection
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable list */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-[13px] font-medium text-ink">
                    {query.trim() ? "No matches found" : "No contacts available"}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-3">
                    {query.trim()
                      ? "Try a different name or email"
                      : "All contacts are already in this audience"}
                  </p>
                </div>
              ) : (
                <ul>
                  {filtered.map((person) => {
                    const isSelected = selected.has(person.id);
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => toggle(person.id)}
                          className={[
                            "flex w-full items-center gap-3 px-6 text-left transition-colors",
                            "border-b border-muted-2 last:border-b-0",
                            isSelected
                              ? "bg-brand-tint hover:bg-brand-tint-2"
                              : "hover:bg-canvas",
                          ].join(" ")}
                          style={{ height: 54 }}
                        >
                          {/* Avatar */}
                          <div
                            className={[
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase",
                              isSelected
                                ? "bg-brand-soft text-brand-strong"
                                : "bg-muted-2 text-ink-2",
                            ].join(" ")}
                          >
                            {initials(person)}
                          </div>

                          {/* Name + email */}
                          <div className="min-w-0 flex-1">
                            <p className={[
                              "truncate text-[13px] font-medium",
                              isSelected ? "text-brand-strong" : "text-ink",
                            ].join(" ")}>
                              {person.first_name} {person.last_name}
                            </p>
                            {person.email && (
                              <p className="truncate text-[11px] text-ink-3">
                                {person.email}
                              </p>
                            )}
                          </div>

                          {/* Check indicator */}
                          <div
                            className={[
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
                              isSelected
                                ? "bg-brand"
                                : "border border-line-strong",
                            ].join(" ")}
                          >
                            {isSelected && (
                              <Check size={11} strokeWidth={2.5} className="text-white" />
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            </div>{/* end middle grid row */}

            {/* ── Footer ── */}
            <div className="border-t border-line px-6 py-4">
              {error && (
                <p className="mb-3 text-[12px] text-red-600">{error}</p>
              )}
              <div className="flex items-center justify-between gap-4">
                {/* Left zone: availability */}
                <p className="text-[12px] text-ink-3">
                  {nonMembers.length.toLocaleString()} available
                </p>

                {/* Center zone: selection count */}
                <p className="text-[12px] font-medium text-ink">
                  {selected.size > 0
                    ? `${selected.size} contact${selected.size !== 1 ? "s" : ""} selected`
                    : <span className="text-ink-3">None selected</span>}
                </p>

                {/* Right zone: actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:text-ink hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    disabled={selected.size === 0 || isPending}
                    className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-1.5 text-[12px] font-medium text-on-ink hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
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
        </div>,
        document.body
      )}
    </>
  );
}
