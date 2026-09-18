import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";

export function FinalCTA({ demoMailto }: { demoMailto: string }) {
  return (
    <section className="relative overflow-hidden bg-ink-teal py-24 sm:py-28 px-4 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 kesher-grid-field-dark"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-full"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, oklch(55% 0.16 258 / 0.35) 0%, transparent 70%)",
        }}
      />
      <div className="relative max-w-3xl mx-auto text-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-teal-fg-muted mb-5">
            Kesher
          </p>
          <h2 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-ink-teal-fg mb-6 leading-[1.1]">
            The messages your school
            <br className="hidden sm:block" /> cannot afford to miss
          </h2>
          <p className="text-[16px] text-ink-teal-fg-muted leading-relaxed mb-10 max-w-lg mx-auto">
            Kesher works with schools directly. Reach out to schedule a demo and see how it fits your
            community.
          </p>
          <a
            href={demoMailto}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full bg-accent px-6 text-[14px] font-medium text-accent-fg hover:bg-accent-hover transition-colors"
          >
            Book a Kesher demo
            <ArrowRight size={14} strokeWidth={2} />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
