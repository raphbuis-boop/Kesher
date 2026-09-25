"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#contact", label: "Contact" },
];

export function LandingHeader({ demoMailto }: { demoMailto: string }) {
  const [open, setOpen] = useState(false);

  // Close the mobile menu on escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <motion.header
      className="sticky top-3 sm:top-4 z-50 px-3 sm:px-6"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-5xl mx-auto rounded-full border border-border bg-[oklch(99.5%_0.002_90_/_0.82)] backdrop-blur-md shadow-[0_4px_24px_rgba(20,40,90,0.06)] px-3 sm:px-3">
        <div className="h-13 sm:h-14 flex items-center justify-between gap-4">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 pl-1.5" aria-label="Kesher home">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary group-hover:bg-accent transition-colors">
              <span className="text-[11px] font-bold text-primary-fg tracking-tight select-none">K</span>
            </div>
            <span className="text-[13px] font-semibold text-text-primary tracking-tight">Kesher</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-3.5 py-1.5 text-[13px] text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center px-3.5 py-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
            <a
              href={demoMailto}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-fg hover:bg-accent transition-colors"
            >
              Book a demo
            </a>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav-panel"
            className="md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-primary"
          >
            {open ? <X size={17} strokeWidth={1.75} /> : <Menu size={17} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div
          id="mobile-nav-panel"
          className="md:hidden max-w-5xl mx-auto mt-2 rounded-2xl border border-border bg-surface shadow-[0_16px_40px_rgba(20,40,90,0.12)] px-4 pb-5 pt-2"
        >
          <nav className="flex flex-col" aria-label="Mobile navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center min-h-[44px] text-[14px] font-medium text-text-primary border-b border-border-subtle last:border-0"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center min-h-[44px] rounded-full border border-border px-4 text-[14px] font-medium text-text-primary"
            >
              Sign in
            </Link>
            <a
              href={demoMailto}
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-full bg-primary px-4 text-[14px] font-medium text-primary-fg"
            >
              Book a demo
            </a>
          </div>
        </div>
      )}
    </motion.header>
  );
}
