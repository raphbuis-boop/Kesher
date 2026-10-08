import Link from "next/link";

const CONTACT_EMAIL = "contact@kesherhq.co";

/**
 * Polished site footer for all public-facing pages.
 * Left: brand + tagline + channels. Right: two columns (Legal, Contact).
 * Bottom bar: copyright.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-subtle bg-surface mt-auto">

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
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary group-hover:bg-primary-hover transition-colors duration-150 shrink-0">
                <span className="text-[11px] font-bold text-primary-fg tracking-tight select-none">K</span>
              </div>
              <span className="text-[13px] font-semibold text-text-primary tracking-tight">Kesher</span>
            </Link>
            <p className="text-[12px] text-text-subtle leading-relaxed max-w-[210px]">
              The modern communications platform for schools.
            </p>
            <p className="text-[11px] text-text-subtle tracking-wide">
              Email · SMS · WhatsApp
            </p>
          </div>

          {/* Right — two nav columns */}
          <div className="flex gap-12 sm:gap-16 shrink-0">

            {/* Column 1 — Legal */}
            <nav aria-label="Legal" className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle mb-0.5">
                Legal
              </p>
              <Link
                href="/privacy"
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                Privacy Policy
              </Link>
              <Link
                href="/sms-terms"
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                SMS Terms
              </Link>
              <Link
                href="/terms"
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                Terms of Service
              </Link>
              <Link
                href="/cta"
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                CTA Documentation
              </Link>
              <Link
                href="/opt-in"
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                Opt-In Documentation
              </Link>
              <Link
                href="/sample-form"
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                Sample Opt-In Form
              </Link>
            </nav>

            {/* Column 2 — Contact */}
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle mb-0.5">
                Contact
              </p>
              <Link
                href="/contact"
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                Contact Us
              </Link>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[12px] text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                {CONTACT_EMAIL}
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div className="border-t border-border-subtle">
        <div className="max-w-[860px] mx-auto px-6 py-4">
          <p className="text-[11px] text-text-subtle">
            © {year} Kesher. Kesher is a product of La Voral LLC. All rights reserved.
          </p>
        </div>
      </div>

    </footer>
  );
}
