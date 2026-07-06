import Link from "next/link";

/**
 * Shared footer for all public-facing (unauthenticated) pages.
 *
 * Design references: Linear, Mercury, Stripe — minimal, typographic, intentional.
 * Two-row layout:
 *   Row 1: Kesher wordmark + tagline (left) | Legal links (right)
 *   Row 2: Copyright (left)
 *
 * Appears on /privacy, /sms-terms, /terms — not inside the authenticated app.
 * The Nav component separately suppresses itself on these routes.
 */

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "SMS Terms",      href: "/sms-terms" },
  { label: "Terms",          href: "/terms" },
] as const;

const SUPPORT_EMAIL = "help@kesherhq.co";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-100 bg-white mt-auto">
      <div className="max-w-4xl mx-auto px-6">

        {/* ── Main row ─────────────────────────────────────────────────── */}
        <div className="py-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

          {/* Left — wordmark + tagline */}
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 group w-fit"
              aria-label="Kesher home"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#0f0f0f] group-hover:bg-[#27272a] transition-colors duration-150">
                <span className="text-[10px] font-bold text-white tracking-tight select-none">K</span>
              </div>
              <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight">Kesher</span>
            </Link>
            <p className="text-[12px] text-zinc-400 leading-snug max-w-[200px]">
              Modern communications for schools.
            </p>
          </div>

          {/* Right — links */}
          <nav
            aria-label="Legal and support"
            className="flex flex-col gap-2.5 sm:items-end"
          >
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-[12px] text-zinc-500 hover:text-[#0f0f0f] transition-colors duration-150 w-fit"
              >
                {label}
              </Link>
            ))}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[12px] text-zinc-500 hover:text-[#0f0f0f] transition-colors duration-150 w-fit"
            >
              Contact
            </a>
          </nav>
        </div>

        {/* ── Copyright row ────────────────────────────────────────────── */}
        <div className="border-t border-zinc-100 py-4">
          <p className="text-[11px] text-zinc-400">
            © {year} Kesher. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
