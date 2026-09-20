"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Users, GraduationCap, Briefcase, UserCheck, Layers, Filter } from "lucide-react";

// Audience segments drawn directly from Kesher's existing product copy
// ("parents, students, staff, alumni, board members, and donors").
const AUDIENCES = [
  { label: "Parents", Icon: Users, count: 412, channels: "SMS · Email" },
  { label: "Students", Icon: GraduationCap, count: 268, channels: "Email" },
  { label: "Faculty", Icon: Briefcase, count: 54, channels: "SMS · Email · WhatsApp" },
  { label: "Alumni", Icon: UserCheck, count: 190, channels: "Email" },
  { label: "Grade 6 — Homeroom B", Icon: Layers, count: 31, channels: "SMS · WhatsApp", custom: true },
];

export function AudienceScreen() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      {/* Copy */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">Audiences</p>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.1]">
          Built around how schools actually communicate
        </h2>
        <p className="text-[16px] text-text-secondary leading-relaxed mb-6">
          Create custom audience segments — grade level, homeroom, specific families. Message exactly
          who needs to hear from you, without copy-pasting lists. Every contact in one place, always
          up to date.
        </p>
        <a
          href="#compose"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-medium text-text-primary hover:border-accent-border hover:bg-surface-2 transition-colors"
        >
          See how sending works
        </a>
      </div>

      {/* Audience screen */}
      <div className="rounded-2xl border border-border bg-surface shadow-[0_8px_48px_rgba(20,40,90,0.10)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
          <div>
            <p className="text-[12px] font-semibold text-text-primary">Audiences</p>
            <p className="text-[10px] text-text-muted mt-px">Your School</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[10px] font-medium text-text-secondary">
            <Filter size={11} strokeWidth={1.75} />
            Filter
          </div>
        </div>

        <div>
          {AUDIENCES.map(({ label, Icon, count, channels, custom }, i) => (
            <motion.div
              key={label}
              className="relative flex items-center gap-3 px-5 py-3.5 border-b border-border-subtle last:border-0 overflow-hidden"
              initial={{ opacity: 0, x: reduceMotion ? 0 : -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: reduceMotion ? 0 : i * 0.09, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Animated highlight sweep */}
              {!reduceMotion && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "linear-gradient(90deg, transparent, var(--accent-tint), transparent)" }}
                  initial={{ x: "-100%" }}
                  whileInView={{ x: "100%" }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.09 + 0.15, duration: 0.7, ease: "easeInOut" }}
                />
              )}

              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-tint">
                <Icon size={14} className="text-accent" strokeWidth={1.75} />
              </div>
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12.5px] font-medium text-text-primary truncate">{label}</p>
                  {custom && (
                    <span className="shrink-0 rounded-full bg-surface-sage border border-surface-sage-border px-1.5 py-px text-[9px] font-semibold text-text-secondary">
                      Custom
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-text-muted mt-0.5">{channels}</p>
              </div>
              <span className="relative text-[13px] font-semibold tabular-nums text-text-primary shrink-0">{count}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
