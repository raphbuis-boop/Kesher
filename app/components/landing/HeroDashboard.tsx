"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Users, CheckCircle2, Bell } from "lucide-react";
import { DashboardPreview } from "./DashboardPreview";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Hero product composition: a soft blue grid/light field, the real dashboard
 * rising up with a spring, and floating data cards layered on top that drift
 * gently with the pointer. Everything degrades to a static, centered layout
 * under prefers-reduced-motion.
 */
export function HeroDashboard() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springX = useSpring(mx, { stiffness: 120, damping: 20, mass: 0.4 });
  const springY = useSpring(my, { stiffness: 120, damping: 20, mass: 0.4 });

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onMouseLeave() {
    mx.set(0);
    my.set(0);
  }

  const cardOffsetA = {
    x: useTransform(springX, [-0.5, 0.5], [10, -10]),
    y: useTransform(springY, [-0.5, 0.5], [8, -8]),
  };
  const cardOffsetB = {
    x: useTransform(springX, [-0.5, 0.5], [-14, 14]),
    y: useTransform(springY, [-0.5, 0.5], [-10, 10]),
  };
  const cardOffsetC = {
    x: useTransform(springX, [-0.5, 0.5], [12, -12]),
    y: useTransform(springY, [-0.5, 0.5], [-9, 9]),
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative"
    >
      {/* Blue grid / light field behind the product */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-10 -inset-y-16 -z-10 kesher-grid-field kesher-grid-animate"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0.01 : 1.1, ease: EASE_OUT }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-10 -inset-y-16 -z-10"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 15%, var(--landing-glow-a) 0%, transparent 68%), radial-gradient(45% 50% at 85% 55%, var(--landing-glow-b) 0%, transparent 70%)",
        }}
      />

      {/* Dashboard rising in with depth */}
      <motion.div
        className="relative mx-auto max-w-5xl [transform-style:preserve-3d]"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 56, scale: reduceMotion ? 1 : 0.96, rotateX: reduceMotion ? 0 : 4 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.15, type: "spring", stiffness: 110, damping: 16, mass: 0.9 }}
        style={{ perspective: 1200 }}
      >
        <div className="[transform:rotate(-0.6deg)] sm:[transform:rotate(-1deg)]">
          <DashboardPreview />
        </div>

        {/* Floating card — audience size */}
        <motion.div
          className="hidden sm:block absolute -left-6 top-16 z-10"
          style={reduceMotion ? undefined : { x: cardOffsetA.x, y: cardOffsetA.y }}
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.65, type: "spring", stiffness: 260, damping: 20 }}
        >
          <FloatingCard icon={<Users size={13} className="text-accent" strokeWidth={2} />} label="Parents" value="40" />
        </motion.div>

        {/* Floating card — delivery rate */}
        <motion.div
          className="hidden sm:block absolute -right-7 top-6 z-10"
          style={reduceMotion ? undefined : { x: cardOffsetB.x, y: cardOffsetB.y }}
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduceMotion ? 0 : 0.82, type: "spring", stiffness: 260, damping: 20 }}
        >
          <FloatingCard icon={<CheckCircle2 size={13} className="text-emerald-500" strokeWidth={2} />} label="Delivered" value="97.6%" />
        </motion.div>

        {/* Floating card — message status notification */}
        <motion.div
          className="hidden md:block absolute -right-10 bottom-10 z-10"
          style={reduceMotion ? undefined : { x: cardOffsetC.x, y: cardOffsetC.y }}
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: reduceMotion ? 0 : 1.0, type: "spring", stiffness: 260, damping: 20 }}
        >
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-[0_16px_40px_rgba(20,40,90,0.16)] whitespace-nowrap">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-tint">
              <Bell size={12} className="text-accent" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-text-primary leading-none">Message delivered</p>
              <p className="text-[10px] text-text-muted mt-1">312 recipients · Email</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function FloatingCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-[0_16px_40px_rgba(20,40,90,0.16)] whitespace-nowrap">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2">{icon}</div>
      <div>
        <p className="text-[10px] font-medium text-text-muted leading-none">{label}</p>
        <p className="text-[15px] font-semibold text-text-primary tabular-nums leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}
