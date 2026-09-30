import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Server-rendered prev/next pager for URL-paginated lists (?page=N).
 * `buildHref(page)` returns the link for a page, preserving other params.
 */
export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const btn =
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e7e7e7] bg-white text-[#71717a] transition-[background-color,color,transform] duration-150 hover:bg-[#f5f5f5] hover:text-[#0f0f0f] active:scale-[0.97]";
  const disabled = "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#f0f0f0] text-[#a1a1aa] opacity-40";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0]">
      <span className="text-[11px] tabular-nums text-[#a1a1aa]">
        {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} aria-label="Previous page" className={btn}>
            <ChevronLeft size={13} strokeWidth={2} />
          </Link>
        ) : (
          <span className={disabled} aria-hidden><ChevronLeft size={13} strokeWidth={2} /></span>
        )}
        <span className="px-1.5 text-[11px] tabular-nums text-[#71717a]">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={buildHref(page + 1)} aria-label="Next page" className={btn}>
            <ChevronRight size={13} strokeWidth={2} />
          </Link>
        ) : (
          <span className={disabled} aria-hidden><ChevronRight size={13} strokeWidth={2} /></span>
        )}
      </div>
    </nav>
  );
}

/** Parses a ?page= value into a 1-based page number. */
export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
