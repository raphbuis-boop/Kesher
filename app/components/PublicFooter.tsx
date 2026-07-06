import Link from "next/link";

const SUPPORT_EMAIL = "help@kesherhq.co";
const PRIVACY_EMAIL = "privacy@kesherhq.co";

/**
 * Polished site footer for all public-facing pages.
 * Left: brand + tagline + channels. Right: two columns (Legal, Contact).
 * Bottom bar: copyright.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-100 bg-white mt-auto">

      {/* ── Main row ─────────────────────────────────────────────────── */}
      <div className="max-w-[860px] mx-auto px-6 py-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">

          {/* Left — brand identity */}
          <div className="flex flex-col gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 group w-fit"
              aria-label="Kesher home"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f] group-hover:bg-[#27272a] transition-colors duration-150 shrink-0">
                <span className="text-[11px] font-bold text-white tracking-tight select-none">K</span>
              </div>
              <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight">Kesher</span>
            </Link>
            <p className="text-[12px] text-zinc-400 leading-relaxed max-w-[210px]">
              The modern communications platform for schools.
            </p>
            <p className="text-[11px] text-zinc-300 tracking-wide">
              Email · SMS · WhatsApp
            </p>
          </div>

          {/* Right — two nav columns */}
          <div className="flex gap-12 sm:gap-16 shrink-0">

            {/* Column 1 — Legal */}
            <nav aria-label="Legal" className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">
                Legal
              </p>
              <Link
                href="/privacy"
                className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
              >
                Privacy Policy
              </Link>
              <Link
                href="/sms-terms"
                className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
              >
                SMS Terms
              </Link>
              <Link
                href="/terms"
                className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
              >
                Terms of Service
              </Link>
            </nav>

            {/* Column 2 — Contact */}
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">
                Contact
              </p>
              <Link
                href="/contact"
                className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
              >
                Contact Us
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
              >
                {SUPPORT_EMAIL}
              </a>
              <a
                href={`mailto:${PRIVACY_EMAIL}`}
                className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
              >
                {PRIVACY_EMAIL}
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div className="border-t border-zinc-100">
        <div className="max-w-[860px] mx-auto px-6 py-4">
          <p className="text-[11px] text-zinc-400">
            © {year} Kesher. All rights reserved.
          </p>
        </div>
      </div>

    </footer>
  );
}
