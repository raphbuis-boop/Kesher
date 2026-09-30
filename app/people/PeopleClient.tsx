"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search, X, ChevronLeft, ChevronRight, Mail, Phone,
  MessageSquare, Download, UserX, ArrowUpDown, ArrowUp, ArrowDown,
  Smartphone, Hash, Users, ExternalLink, Check,
} from "lucide-react";
import type { PersonRow } from "./page";
import type { CategoryCounts } from "@/lib/categoryCounts";
import { PEOPLE_PAGE_SIZE as PAGE_SIZE, type PeopleQuery, type PeopleSortKey } from "./query";

// ─── constants ───────────────────────────────────────────────────────────────

const CATEGORY_DEFS = [
  { value: "student",     label: "Student",     plural: "Students",     badge: "bg-blue-50 text-blue-700",     chip: "text-blue-700" },
  { value: "parent",      label: "Parent",      plural: "Parents",      badge: "bg-violet-50 text-violet-700", chip: "text-violet-700" },
  { value: "faculty",     label: "Faculty",     plural: "Faculty",      badge: "bg-amber-50 text-amber-700",   chip: "text-amber-700" },
  { value: "staff",       label: "Staff",       plural: "Staff",        badge: "bg-slate-100 text-slate-600",  chip: "text-slate-600" },
  { value: "alumni",      label: "Alumni",      plural: "Alumni",       badge: "bg-emerald-50 text-emerald-700", chip: "text-emerald-700" },
  { value: "donor",       label: "Donor",       plural: "Donors",       badge: "bg-yellow-50 text-yellow-700", chip: "text-yellow-700" },
  { value: "grandparent", label: "Grandparent", plural: "Grandparents", badge: "bg-purple-50 text-purple-700", chip: "text-purple-700" },
  { value: "board",       label: "Board",       plural: "Board",        badge: "bg-rose-50 text-rose-700",     chip: "text-rose-700" },
  { value: "prospect",    label: "Prospect",    plural: "Prospects",    badge: "bg-zinc-100 text-zinc-600",    chip: "text-zinc-600" },
] as const;

type CategoryValue = typeof CATEGORY_DEFS[number]["value"];
type SortKey = PeopleSortKey;
type SortDir = PeopleQuery["dir"];

function getCategoryDef(value: string) {
  return CATEGORY_DEFS.find((c) => c.value === value);
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function exportCSV(people: PersonRow[]) {
  const header = "Name,Email,Phone,Grade,Audiences,Tags";
  const rows = people.map((p) =>
    [
      `"${p.first_name} ${p.last_name}"`,
      p.email ?? "",
      p.phone ?? "",
      p.grade ?? "",
      `"${(p.categories ?? []).join(", ")}"`,
      `"${p.person_tags.map((pt) => pt.tags.name).join(", ")}"`,
    ].join(",")
  );
  const blob = new Blob([`${header}\n${rows.join("\n")}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CategoryBadge ────────────────────────────────────────────────────────────

function CategoryBadge({ value }: { value: string }) {
  const def = getCategoryDef(value);
  if (!def) return null;
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${def.badge}`}>
      {def.label}
    </span>
  );
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  indeterminate = false,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={[
        "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all duration-100",
        checked || indeterminate
          ? "border-[#2563eb] bg-[#2563eb]"
          : "border-[#d4d4d8] bg-white hover:border-[#a1a1aa]",
      ].join(" ")}
    >
      {checked && <Check size={9} className="text-white" strokeWidth={3} />}
      {!checked && indeterminate && <span className="h-0.5 w-2 rounded-full bg-white" />}
    </button>
  );
}

// ─── SortButton ──────────────────────────────────────────────────────────────

function SortBtn({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa] hover:text-[#71717a] transition-colors"
    >
      {children}
      <Icon size={10} strokeWidth={2} className={active ? "text-[#71717a]" : "text-[#d4d4d8]"} />
    </button>
  );
}

// ─── Contact drawer ───────────────────────────────────────────────────────────

function PersonDrawer({
  person,
  onClose,
}: {
  person: PersonRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cats = person.categories ?? [];
  const ini = initials(person.first_name, person.last_name);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/[0.07] backdrop-blur-[2px] animate-backdrop" onClick={onClose} />
      <div className="animate-slide-right relative flex w-full max-w-[340px] flex-col bg-white border-l border-[#e7e7e7] shadow-2xl shadow-black/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[#f0f0f0] px-5 py-5 flex-shrink-0">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[13px] font-semibold text-[#71717a]">
            {ini}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[15px] font-semibold text-[#0f0f0f] leading-tight">
              {person.first_name} {person.last_name}
            </p>
            {cats.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {cats.map((c) => <CategoryBadge key={c} value={c} />)}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-lg p-1.5 text-[#a1a1aa] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Contact info */}
          <div>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Contact</p>
            <div className="rounded-xl border border-[#e7e7e7] divide-y divide-[#f5f5f5]">
              {person.email ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Mail size={13} className="flex-shrink-0 text-[#a1a1aa]" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#a1a1aa]">Email</p>
                    <p className="truncate font-mono text-[12px] text-[#0f0f0f]">{person.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 opacity-40">
                  <Mail size={13} className="flex-shrink-0 text-[#a1a1aa]" strokeWidth={1.75} />
                  <p className="text-[12px] text-[#a1a1aa]">No email</p>
                </div>
              )}
              {person.phone ? (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Phone size={13} className="flex-shrink-0 text-[#a1a1aa]" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#a1a1aa]">Phone</p>
                    <p className="font-mono text-[12px] text-[#0f0f0f]">{person.phone}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 opacity-40">
                  <Phone size={13} className="flex-shrink-0 text-[#a1a1aa]" strokeWidth={1.75} />
                  <p className="text-[12px] text-[#a1a1aa]">No phone</p>
                </div>
              )}
              {person.whatsapp && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <MessageSquare size={13} className="flex-shrink-0 text-emerald-500" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#a1a1aa]">WhatsApp</p>
                    <p className="font-mono text-[12px] text-[#0f0f0f]">{person.whatsapp}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          {(person.grade || cats.length > 0) && (
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Details</p>
              <div className="rounded-xl border border-[#e7e7e7] divide-y divide-[#f5f5f5]">
                {person.grade && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-[#a1a1aa]">Grade</p>
                    <p className="mt-0.5 text-[13px] text-[#0f0f0f]">{person.grade}</p>
                  </div>
                )}
                {cats.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-[#a1a1aa]">Audiences</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {cats.map((c) => {
                        const def = getCategoryDef(c);
                        return (
                          <Link
                            key={c}
                            href={`/audiences/${c}s`}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80 ${def?.badge ?? "bg-zinc-100 text-zinc-600"}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {def?.label ?? c}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {person.person_tags.length > 0 && (
            <div>
              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {person.person_tags.map((pt) => (
                  <span
                    key={pt.tag_id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[11px] font-medium text-[#71717a]"
                  >
                    <Hash size={9} strokeWidth={2.5} className="text-[#a1a1aa]" />
                    {pt.tags.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#f0f0f0] px-5 py-4 flex-shrink-0 flex gap-2">
          <Link
            href={`/messages/new?person=${person.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#e7e7e7] bg-[#fafafa] py-2 text-[12px] font-medium text-[#71717a] hover:bg-white hover:text-[#0f0f0f] hover:shadow-sm transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <Smartphone size={12} strokeWidth={2} />
            Message
          </Link>
          <Link
            href={`/people/${person.id}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#0f0f0f] py-2 text-[12px] font-medium text-white hover:bg-[#27272a] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} strokeWidth={2} />
            Full profile
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Floating bulk toolbar ────────────────────────────────────────────────────

function BulkToolbar({
  count,
  people,
  onClear,
}: {
  count: number;
  people: PersonRow[];
  onClear: () => void;
}) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 animate-fade-up">
      <div className="flex items-center gap-3 rounded-xl border border-[#e7e7e7] bg-white px-4 py-3 shadow-lg shadow-black/8 ring-1 ring-black/[0.04]">
        <span className="text-[12px] font-semibold text-[#0f0f0f]">
          {count} selected
        </span>
        <div className="h-4 w-px bg-[#e7e7e7]" />
        <div className="flex items-center gap-1">
          <Link
            href={`/messages/new`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] transition-colors"
          >
            <Smartphone size={12} strokeWidth={2} />
            Message
          </Link>
          <button
            onClick={() => exportCSV(people)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] transition-colors"
          >
            <Download size={12} strokeWidth={2} />
            Export
          </button>
        </div>
        <div className="h-4 w-px bg-[#e7e7e7]" />
        <button
          onClick={onClear}
          aria-label="Clear selection"
          className="rounded-lg p-1.5 text-[#a1a1aa] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] transition-colors"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Filtering, search, sorting and pagination live in the URL and run in the
 * database (see ./query.ts), so only one page of contacts is ever loaded.
 */
export function PeopleClient({
  people,
  matchCount,
  counts,
  query,
}: {
  people: PersonRow[];
  matchCount: number;
  counts: CategoryCounts;
  query: PeopleQuery;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();

  const categoryFilter = query.cat as CategoryValue | null;
  const sortKey = query.sort;
  const sortDir = query.dir;
  const clampedPage = query.page;

  const [search, setSearch] = useState(query.q);
  // Selected rows are kept (not just ids) so a selection survives paging
  const [selected, setSelected] = useState<Map<string, PersonRow>>(new Map());
  const [drawerPerson, setDrawerPerson] = useState<PersonRow | null>(null);
  const selectedIds = new Set(selected.keys());

  function navigate(changes: Partial<Record<"q" | "cat" | "sort" | "dir" | "page", string | null>>) {
    const params = new URLSearchParams();
    const next = { q: query.q, cat: query.cat, sort: query.sort, dir: query.dir, page: String(query.page), ...changes };
    if (next.q) params.set("q", next.q);
    if (next.cat) params.set("cat", next.cat);
    if (next.sort && next.sort !== "name") params.set("sort", next.sort);
    if (next.dir && next.dir !== "asc") params.set("dir", next.dir);
    if (next.page && next.page !== "1") params.set("page", next.page);
    const qs = params.toString();
    startNavigation(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // Debounced server-side search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearch(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => navigate({ q: value.trim() || null, page: null }), 250);
  }
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  const categoryCounts = counts.byCategory;
  const totalPages = Math.max(1, Math.ceil(matchCount / PAGE_SIZE));
  const paginated = people;
  const setPage = (p: number) => navigate({ page: String(p) });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      navigate({ dir: sortDir === "asc" ? "desc" : "asc", page: null });
    } else {
      navigate({ sort: key, dir: "asc", page: null });
    }
  }

  function handleCategoryFilter(value: CategoryValue | null) {
    setSearch("");
    setSelected(new Map());
    navigate({ cat: value, q: null, page: null });
  }

  function clearFilters() {
    setSearch("");
    navigate({ cat: null, q: null, page: null });
  }

  function toggleSelect(person: PersonRow) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelected = paginated.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Map(prev);
      for (const p of paginated) {
        if (allSelected) next.delete(p.id);
        else next.set(p.id, p);
      }
      return next;
    });
  }

  const pageIds = paginated.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;

  const selectedPeople = [...selected.values()];

  const startIdx = (clampedPage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(clampedPage * PAGE_SIZE, matchCount);
  const hasFilters = !!(query.q || categoryFilter);

  return (
    <>
      {/* Category chips toolbar */}
      <div className="border-b border-[#e7e7e7] bg-white">
        <div className="flex items-center gap-0 overflow-x-auto px-6 py-3">
          <button
            onClick={() => handleCategoryFilter(null)}
            className={[
              "mr-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-100",
              categoryFilter === null
                ? "bg-[#0f0f0f] text-white"
                : "text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]",
            ].join(" ")}
          >
            All
            <span className={`text-[10px] tabular-nums ${categoryFilter === null ? "opacity-60" : "text-[#a1a1aa]"}`}>
              {counts.total}
            </span>
          </button>

          {CATEGORY_DEFS.filter((def) => (categoryCounts[def.value] ?? 0) > 0).map((def) => {
            const isActive = categoryFilter === def.value;
            return (
              <button
                key={def.value}
                onClick={() => handleCategoryFilter(isActive ? null : def.value as CategoryValue)}
                className={[
                  "mr-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-all duration-100",
                  isActive
                    ? "bg-[#eff6ff] text-[#2563eb]"
                    : "text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]",
                ].join(" ")}
              >
                {def.plural}
                <span className={`text-[10px] tabular-nums ${isActive ? "text-[#2563eb] opacity-70" : "text-[#a1a1aa]"}`}>
                  {categoryCounts[def.value]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search + count bar */}
      <div className="border-b border-[#e7e7e7] bg-white px-6 py-2.5">
        <div className="flex items-center gap-3">
          <div className="relative max-w-[280px] flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]"
              strokeWidth={2}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search name, email, phone, grade, tags…"
              className="w-full rounded-lg border border-[#e7e7e7] bg-[#fafafa] py-1.5 pl-8 pr-8 text-[12px] text-[#0f0f0f] placeholder-[#c4c4c8] outline-none transition-all focus:border-[#a1a1aa] focus:bg-white focus:shadow-sm"
            />
            {search && (
              <button
                onClick={() => handleSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#a1a1aa] hover:text-[#0f0f0f] transition-colors"
              >
                <X size={11} strokeWidth={2} />
              </button>
            )}
          </div>

          <span className="ml-auto inline-flex items-center gap-2 text-[11px] tabular-nums text-[#a1a1aa]" aria-live="polite">
            {isNavigating && (
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[#d4d4d8] border-t-[#71717a]" aria-label="Loading" />
            )}
            {!hasFilters
              ? `${counts.total.toLocaleString()} contacts`
              : `${matchCount.toLocaleString()} of ${counts.total.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4 pb-20">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e7e7e7] bg-white mb-4">
              <UserX size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-[#0f0f0f]">
              {hasFilters ? "No contacts match" : "No contacts yet"}
            </p>
            <p className="mt-1 text-[12px] text-[#a1a1aa]">
              {hasFilters
                ? "Try adjusting your search or filters."
                : "Add your first contact to get started."}
            </p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 rounded-lg border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#fafafa] transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className={`overflow-hidden rounded-xl border border-[#e7e7e7] bg-white transition-opacity duration-150 ${isNavigating ? "opacity-60" : ""}`}>
            <table className="w-full">
              <thead className="sticky top-[57px] z-[5]">
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-4 pr-2 w-10">
                    <Checkbox
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-2.5 pr-3 text-left">
                    <SortBtn
                      active={sortKey === "name"}
                      dir={sortDir}
                      onClick={() => handleSort("name")}
                    >
                      Name
                    </SortBtn>
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Email
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Phone
                  </th>
                  <th className="pl-3 pr-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Tags
                  </th>
                  <th className="pl-3 pr-4 py-2.5 text-right">
                    <SortBtn
                      active={sortKey === "created_at"}
                      dir={sortDir}
                      onClick={() => handleSort("created_at")}
                    >
                      Added
                    </SortBtn>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((person, i) => {
                  const isLast = i === paginated.length - 1;
                  const isSelected = selectedIds.has(person.id);
                  const cats = person.categories ?? [];
                  const validTags = person.person_tags.filter((pt) => pt.tags != null);
                  const visibleTags = validTags.slice(0, 2);
                  const overflowTags = validTags.length - visibleTags.length;
                  const subline = [
                    person.grade ? `Grade ${person.grade}` : null,
                    cats.length > 0 ? getCategoryDef(cats[0])?.label : null,
                  ].filter(Boolean).join(" · ");

                  return (
                    <tr
                      key={person.id}
                      onClick={() => setDrawerPerson(person)}
                      className={[
                        "group cursor-pointer transition-colors duration-100",
                        !isLast ? "border-b border-[#f5f5f5]" : "",
                        isSelected
                          ? "bg-[#eff6ff] hover:bg-[#e8f0fe]"
                          : "hover:bg-[#fafafa]",
                      ].join(" ")}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2 w-10">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleSelect(person)}
                        />
                      </td>

                      {/* Name + subtitle */}
                      <td className="py-3.5 pr-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={[
                              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                              isSelected
                                ? "bg-[#dbeafe] text-[#1d4ed8]"
                                : "bg-[#f0f0f0] text-[#71717a]",
                            ].join(" ")}
                          >
                            {initials(person.first_name, person.last_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-[#0f0f0f] leading-tight">
                              {person.first_name} {person.last_name}
                            </p>
                            {subline && (
                              <p className="mt-0.5 text-[11px] text-[#a1a1aa] leading-tight">
                                {subline}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-3 py-3.5 max-w-[180px]">
                        {person.email ? (
                          <span
                            title={person.email}
                            className="block truncate text-[12px] text-[#71717a] font-mono"
                          >
                            {person.email}
                          </span>
                        ) : (
                          <span className="text-[#e0e0e0] text-[12px]">—</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-3.5">
                        {person.phone ? (
                          <span className="text-[12px] font-mono text-[#71717a]">{person.phone}</span>
                        ) : (
                          <span className="text-[#e0e0e0] text-[12px]">—</span>
                        )}
                      </td>

                      {/* Tags (max 2 + overflow) */}
                      <td className="pl-3 pr-4 py-3.5">
                        {validTags.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {visibleTags.map((pt) => (
                              <span
                                key={pt.tag_id}
                                className="inline-flex items-center rounded-md bg-[#f5f5f5] px-1.5 py-0.5 text-[10px] font-medium text-[#71717a]"
                              >
                                {pt.tags.name}
                              </span>
                            ))}
                            {overflowTags > 0 && (
                              <span className="inline-flex items-center rounded-md bg-[#f0f0f0] px-1.5 py-0.5 text-[10px] font-medium text-[#a1a1aa]">
                                +{overflowTags}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#e0e0e0] text-[12px]">—</span>
                        )}
                      </td>

                      {/* Added date */}
                      <td className="pl-3 pr-4 py-3.5 text-right">
                        <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                          {new Date(person.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination footer */}
            {matchCount > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
                <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                  {startIdx}–{endIdx} of {matchCount.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, clampedPage - 1))}
                    aria-label="Previous page"
                    disabled={clampedPage === 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e7e7e7] bg-white text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={13} strokeWidth={2} />
                  </button>
                  <div className="flex items-center gap-0.5 px-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={[
                            "flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-medium transition-all",
                            clampedPage === p
                              ? "bg-[#0f0f0f] text-white"
                              : "text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]",
                          ].join(" ")}
                        >
                          {p}
                        </button>
                      );
                    })}
                    {totalPages > 7 && (
                      <span className="px-1 text-[11px] text-[#a1a1aa]">…{totalPages}</span>
                    )}
                  </div>
                  <button
                    onClick={() => setPage(Math.min(totalPages, clampedPage + 1))}
                    aria-label="Next page"
                    disabled={clampedPage === totalPages}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e7e7e7] bg-white text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={13} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating bulk toolbar */}
      <BulkToolbar
        count={selected.size}
        people={selectedPeople}
        onClear={() => setSelected(new Map())}
      />

      {/* Contact drawer */}
      {drawerPerson && (
        <PersonDrawer
          person={drawerPerson}
          onClose={() => setDrawerPerson(null)}
        />
      )}
    </>
  );
}
