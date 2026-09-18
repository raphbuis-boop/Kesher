"use client";

import { useEffect, useRef, useState } from "react";
import { motion, animate, useInView, useReducedMotion } from "framer-motion";
import { CheckCircle2, MailOpen, XCircle } from "lucide-react";

// Ascending delivery-rate trend — decorative, no per-point figures invented.
const POINTS = [61, 68, 65, 74, 79, 85, 82, 90, 88, 97.6];
const CHART_W = 300;
const CHART_H = 84;
const PAD_Y = 6;

function pathFor(points: number[]) {
  const step = CHART_W / (points.length - 1);
  return points
    .map((v, i) => {
      const x = i * step;
      const y = CHART_H - PAD_Y - (v / 100) * (CHART_H - PAD_Y * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const LINE_PATH = pathFor(POINTS);
const AREA_PATH = `${LINE_PATH} L${CHART_W},${CHART_H} L0,${CHART_H} Z`;

const ACTIVITY = [
  { name: "M. Cohen", detail: "Parents · Email", status: "delivered" as const },
  { name: "R. Levi", detail: "Parents · SMS", status: "opened" as const },
  { name: "S. Katz", detail: "Faculty · Email", status: "delivered" as const },
  { name: "D. Weiss", detail: "Parents · SMS", status: "failed" as const },
];

const STATUS_META = {
  delivered: { label: "Delivered", Icon: CheckCircle2, className: "text-emerald-600 bg-emerald-50" },
  opened: { label: "Opened", Icon: MailOpen, className: "text-accent bg-accent-tint" },
  failed: { label: "Failed", Icon: XCircle, className: "text-red-500 bg-red-50" },
};

export function AnalyticsSection() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
      <div className="rounded-2xl border border-ink-teal-border bg-ink-teal-2 p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-teal-fg-muted mb-1">
          Delivery performance
        </p>
        <p className="text-[13px] text-ink-teal-fg-muted mb-6">Last 30 days</p>
        <div className="flex items-end gap-3 mb-6">
          <span className="text-[44px] sm:text-[52px] font-semibold tracking-tight tabular-nums leading-none text-ink-teal-fg">
            <CountUp value={97.6} decimals={1} suffix="%" />
          </span>
          <span className="text-[13px] text-ink-teal-fg-muted mb-1.5">delivery rate</span>
        </div>

        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-24 sm:h-28 overflow-visible">
          <defs>
            <linearGradient id="kesher-line-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path
            d={AREA_PATH}
            fill="url(#kesher-line-fill)"
            stroke="none"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: reduceMotion ? 0 : 0.5, duration: reduceMotion ? 0.01 : 0.6 }}
          />
          <motion.path
            d={LINE_PATH}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: reduceMotion ? 0.01 : 1.3, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
      </div>

      <div className="rounded-2xl border border-ink-teal-border bg-ink-teal-2 p-5 sm:p-6 flex flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-teal-fg-muted mb-4">
          Recipient activity
        </p>
        <div className="flex-1 flex flex-col gap-1">
          {ACTIVITY.map(({ name, detail, status }, i) => {
            const meta = STATUS_META[status];
            return (
              <motion.div
                key={name}
                className="flex items-center gap-3 py-2.5 border-b border-ink-teal-border last:border-0"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: reduceMotion ? 0 : 0.15 + i * 0.12, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-ink-teal-fg truncate">{name}</p>
                  <p className="text-[10.5px] text-ink-teal-fg-muted mt-0.5">{detail}</p>
                </div>
                <span className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
                  <meta.Icon size={10} strokeWidth={2.25} />
                  {meta.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CountUp({ value, suffix = "", decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduceMotion = useReducedMotion();
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setAnimated(v),
      onComplete: () => setAnimated(value),
    });
    return () => controls.stop();
  }, [inView, reduceMotion, value]);

  const display = reduceMotion ? value : animated;

  return (
    <span ref={ref}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
