"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { WordReveal } from "./WordReveal";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function HeroContent({ demoMailto }: { demoMailto: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <>
      {/* Eyebrow */}
      <motion.div
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 mb-7"
        initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0.01 : 0.5, ease: EASE_OUT }}
      >
        <div className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="text-[11px] font-medium text-text-secondary tracking-wide">
          School communications, finally connected
        </span>
      </motion.div>

      {/* Headline — word-by-word stagger */}
      <WordReveal
        lines={["Every school message.", "One clear path."]}
        className="text-[42px] sm:text-6xl lg:text-[68px] font-semibold tracking-[-0.03em] leading-[1.05] text-text-primary mb-6"
      />

      {/* Supporting copy + CTAs — enter as a group, 150ms after the headline starts */}
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.15, duration: reduceMotion ? 0.01 : 0.55, ease: EASE_OUT }}
      >
        <p className="text-[17px] sm:text-[18px] text-text-secondary leading-relaxed max-w-xl mx-auto mb-8">
          Build the right audience, send through the right channel, and see exactly what reached your community.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <a
            href={demoMailto}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full bg-accent px-6 text-[14px] font-medium text-accent-fg hover:bg-accent-hover transition-colors"
          >
            Book a demo
            <ArrowRight size={14} strokeWidth={2} />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-1.5 min-h-[48px] rounded-full border border-border bg-surface px-6 text-[14px] font-medium text-text-primary hover:border-accent-border hover:bg-surface-2 transition-colors"
          >
            Watch the workflow ↗
          </a>
        </div>
      </motion.div>
    </>
  );
}
