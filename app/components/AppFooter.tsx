"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pages that have their own PublicFooter — skip AppFooter on these
const PUBLIC_ROUTES = new Set(["/privacy", "/sms-terms", "/terms"]);

/**
 * Slim footer rendered inside <main> in the root layout.
 * Appears at the bottom of every page — authenticated app and login.
 * Hidden on /privacy, /sms-terms, /terms which have their own PublicFooter.
 */
export function AppFooter() {
  const pathname = usePathname();
  if (PUBLIC_ROUTES.has(pathname)) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[#f0f0f0] bg-[#fafafa]">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        {/* Links */}
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-5 gap-y-1"
        >
          <Link
            href="/privacy"
            className="text-[11px] text-[#a1a1aa] hover:text-[#71717a] transition-colors duration-150"
          >
            Privacy Policy
          </Link>
          <Link
            href="/sms-terms"
            className="text-[11px] text-[#a1a1aa] hover:text-[#71717a] transition-colors duration-150"
          >
            SMS Terms
          </Link>
          <Link
            href="/terms"
            className="text-[11px] text-[#a1a1aa] hover:text-[#71717a] transition-colors duration-150"
          >
            Terms
          </Link>
          <a
            href="mailto:help@kesherhq.co"
            className="text-[11px] text-[#a1a1aa] hover:text-[#71717a] transition-colors duration-150"
          >
            Contact
          </a>
        </nav>

        {/* Copyright */}
        <p className="text-[11px] text-[#c4c4c8] tabular-nums">
          © {year} Kesher
        </p>
      </div>
    </footer>
  );
}
