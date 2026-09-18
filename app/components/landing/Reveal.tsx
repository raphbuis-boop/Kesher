"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Scroll-reveal wrapper. Animates once, the first time it enters the viewport.
 * `prefers-reduced-motion` collapses this to an instant, opacity-only reveal.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 14,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduceMotion ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: reduceMotion ? 0.01 : 0.6, delay: reduceMotion ? 0 : delay / 1000, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

