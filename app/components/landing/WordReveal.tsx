"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Splits text into words and reveals them with a fast stagger — each word
 * rises and fades in independently. Line breaks in `lines` render as
 * separate rows so the stagger reads left-to-right, top-to-bottom.
 */
export function WordReveal({
  lines,
  className = "",
  wordClassName = "",
  delay = 0,
}: {
  lines: string[];
  className?: string;
  wordClassName?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.055,
        delayChildren: reduceMotion ? 0 : delay / 1000,
      },
    },
  };

  const word: Variants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 16, filter: reduceMotion ? "none" : "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduceMotion ? 0.01 : 0.5, ease: EASE_OUT },
    },
  };

  return (
    <motion.h1 className={className} initial="hidden" animate="visible" variants={container} aria-label={lines.join(" ")}>
      {lines.map((line, li) => (
        <span className="block" key={li} aria-hidden="true">
          {line.split(" ").map((w, wi) => (
            <span key={wi} className="inline-block overflow-hidden pb-1 align-bottom">
              <motion.span className={`inline-block ${wordClassName}`} variants={word}>
                {w}
                {wi < line.split(" ").length - 1 ? " " : ""}
              </motion.span>
            </span>
          ))}
        </span>
      ))}
    </motion.h1>
  );
}
