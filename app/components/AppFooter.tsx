"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pages that render their own footer — suppress AppFooter on these
const PUBLIC_ROUTES = new Set(["/", "/privacy", "/sms-terms", "/terms", "/contact", "/cta", "/opt-in", "/sample-form", "/login", "/reset-password", "/forgot-password"]);

const CONTACT_EMAIL = "contact@kesherhq.co";

/**
 * Site footer rendered inside <main> in the root layout.
 * Appears on every authenticated page and on /login.
 * Suppressed on public legal/contact pages which embed their own footer.
 */
export function AppFooter() {
  const pathname = usePathname();
  if (PUBLIC_ROUTES.has(pathname)) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-zinc-100 bg-white">

      {/* ── Main row ─────────────────────────────────────────────────── */}
      <div className="px-6 py-10 flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">

        {/* Left — brand identity */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="inline-flex items-center gap-2.5 w-fit">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f] shrink-0">
              <span className="text-[11px] font-bold text-white tracking-tight select-none">K</span>
            </div>
            <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight">Kesher</span>
          </div>
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
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors duration-150"
            >
              {CONTACT_EMAIL}
            </a>
          </div>

        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div className="border-t border-zinc-100 px-6 py-4">
        <p className="text-[11px] text-zinc-400">
          © {year} Kesher. Kesher is a product of La Voral LLC. All rights reserved.
        </p>
      </div>

    </footer>
  );
}
