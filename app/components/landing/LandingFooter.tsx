import Link from "next/link";

export function LandingFooter({ contactEmail }: { contactEmail: string; demoMailto: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink-teal">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3 max-w-[240px]">
            <div className="inline-flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-teal-fg">
                <span className="text-[11px] font-bold text-ink-teal tracking-tight select-none">K</span>
              </div>
              <span className="text-[13px] font-semibold text-ink-teal-fg tracking-tight">Kesher</span>
            </div>
            <p className="text-[12px] text-ink-teal-fg-muted leading-relaxed">
              Kesher — &quot;connection&quot; in Hebrew. Purpose-built communications for schools and
              educational organizations.
            </p>
            <p className="text-[11px] text-ink-teal-fg-muted/70">Email · SMS · WhatsApp</p>
          </div>

          <div className="flex gap-12 sm:gap-16 shrink-0 flex-wrap">
            <nav className="flex flex-col gap-2.5" aria-label="Platform">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-teal-fg-muted/70 mb-0.5">Platform</p>
              <a href="#product" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">Product</a>
              <a href="#how-it-works" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">How it works</a>
              <a href="#security" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">Security</a>
              <a href="#contact" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">Contact</a>
            </nav>
            <nav className="flex flex-col gap-2.5" aria-label="Legal">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-teal-fg-muted/70 mb-0.5">Legal</p>
              <Link href="/privacy" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">Privacy Policy</Link>
              <Link href="/sms-terms" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">SMS Terms</Link>
              <Link href="/terms" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">Terms of Service</Link>
              <Link href="/cta" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">CTA Documentation</Link>
              <Link href="/sample-form" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">Sample Opt-In Form</Link>
            </nav>
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-teal-fg-muted/70 mb-0.5">Contact</p>
              <Link href="/contact" className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">Contact Us</Link>
              <a href={`mailto:${contactEmail}`} className="text-[12px] text-ink-teal-fg-muted hover:text-ink-teal-fg transition-colors">{contactEmail}</a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-teal-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-[11px] text-ink-teal-fg-muted">© {year} Kesher. Kesher is a product of La Voral LLC. All rights reserved.</p>
          <p className="text-[11px] text-ink-teal-fg-muted/70">
            Kesher is not affiliated with any individual school. Schools are responsible for obtaining and maintaining consent records.
          </p>
        </div>
      </div>
    </footer>
  );
}
