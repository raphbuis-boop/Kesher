import Link from "next/link";

/**
 * Shared header for all public-facing (unauthenticated) pages.
 * Keeps a single consistent identity across /privacy, /sms-terms, /terms.
 */
export function PublicHeader() {
  return (
    <header className="border-b border-zinc-100 bg-white">
      <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="Kesher home"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f] group-hover:bg-[#27272a] transition-colors duration-150">
            <span className="text-[11px] font-bold text-white tracking-tight select-none">K</span>
          </div>
          <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight">Kesher</span>
        </Link>
      </div>
    </header>
  );
}
