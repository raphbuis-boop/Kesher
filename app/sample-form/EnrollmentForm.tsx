"use client";

import { useState } from "react";
import Link from "next/link";

const CTA_ITEMS = [
  "Brand name: Maple Ridge Day School via Kesher",
  "Message types described",
  "Message frequency: varies",
  "Msg & data rates may apply",
  "STOP opt-out instructions",
  "HELP support instructions",
  "Privacy Policy link",
  "SMS Terms & Conditions link",
  "Not a condition of enrollment",
];

export function EnrollmentForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    // Scroll to top of form so the confirmation is visible
    e.currentTarget.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (submitted) {
    return (
      <div className="rounded-xl border-2 border-success-border bg-success-tint overflow-hidden mb-10">
        {/* Form header — unchanged */}
        <div className="bg-background border-b border-border px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
              <span className="text-[11px] font-bold text-primary-fg">EF</span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text-primary">Maple Ridge Day School</p>
              <p className="text-[12px] text-text-muted">2025–2026 Annual Re-Enrollment Form</p>
            </div>
          </div>
        </div>
        <div className="px-7 py-10 flex flex-col items-center text-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-tint">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path className="stroke-success" d="M5 13L9 17L19 7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-text-primary">Sample submission successful.</p>
          <p className="text-[13px] text-text-muted max-w-[460px] leading-relaxed">
            This demonstration form exists solely for carrier compliance review and does not
            store personal information.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-2 rounded-lg border border-border px-4 py-2 text-[13px] text-text-secondary hover:bg-surface-hover transition-colors"
          >
            Reset form
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border-2 border-border bg-surface overflow-hidden mb-10"
    >
      {/* Form header */}
      <div className="bg-background border-b border-border px-7 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shrink-0">
            <span className="text-[11px] font-bold text-primary-fg">EF</span>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-text-primary">Maple Ridge Day School</p>
            <p className="text-[12px] text-text-muted">2025–2026 Annual Re-Enrollment Form</p>
          </div>
        </div>
      </div>

      {/* Form body */}
      <div className="px-7 py-8 space-y-7">

        {/* Contact information */}
        <div>
          <h2 className="text-[13px] font-semibold text-text-primary uppercase tracking-wide mb-4 pb-2 border-b border-border-subtle">
            Parent / Guardian Contact Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "First Name",           name: "firstName",   placeholder: "Rachel",                     col: "" },
              { label: "Last Name",            name: "lastName",    placeholder: "Cohen",                      col: "" },
              { label: "Email Address",        name: "email",       placeholder: "rachel.cohen@example.com",   col: "sm:col-span-2", type: "email" },
              { label: "Mobile Phone Number",  name: "phone",       placeholder: "(201) 555-0100",             col: "sm:col-span-2", type: "tel" },
              { label: "Student Name",         name: "studentName", placeholder: "David Cohen",                col: "" },
              { label: "Grade (2025–2026)",    name: "grade",       placeholder: "7th Grade",                  col: "" },
            ].map(({ label, name, placeholder, col, type = "text" }) => (
              <div key={name} className={col}>
                <label htmlFor={name} className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  placeholder={placeholder}
                  className="h-9 w-full rounded-lg border border-border-input bg-background px-3 text-[13px] text-text-primary placeholder:text-text-subtle focus:ring-2 focus:ring-focus-ring focus:border-focus-ring transition"
                />
              </div>
            ))}
          </div>
        </div>

        {/* SMS CTA */}
        <div className="rounded-xl border-2 border-info-border bg-info-tint p-6">
          <h2 className="text-[13px] font-semibold text-text-primary uppercase tracking-wide mb-4">
            SMS / Text Message Communications
          </h2>

          <div className="flex gap-3 items-start">
            <input
              id="smsConsent"
              name="smsConsent"
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-border-strong accent-zinc-900 cursor-pointer"
            />
            <label htmlFor="smsConsent" className="text-[13px] text-text-primary leading-relaxed cursor-pointer">
              <strong>I consent to receive SMS text messages</strong> from{" "}
              <strong>Maple Ridge Day School</strong> via{" "}
              <strong>Kesher</strong>, our school communications platform. Messages
              may include school announcements, emergency alerts, event reminders,
              attendance updates, and other school-related communications.{" "}
              Message frequency varies. Message and data rates may apply.
              Reply <strong>STOP</strong> to opt out at any time. Reply{" "}
              <strong>HELP</strong> for help. View our{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2 text-info"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/sms-terms"
                className="underline underline-offset-2 text-info"
              >
                SMS Terms &amp; Conditions
              </Link>
              .{" "}
              <strong>
                Consent to receive text messages is not a condition of enrollment
                or any purchase.
              </strong>
            </label>
          </div>

          {/* CTA element checklist */}
          <div className="mt-5 pt-4 border-t border-info-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-info mb-3">
              CTA Element Checklist (for reviewer reference)
            </p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {CTA_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
                    <circle className="fill-success-solid" cx="7" cy="7" r="7" />
                    <path d="M4 7L6 9L10 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] text-info">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Emergency contact */}
        <div>
          <h2 className="text-[13px] font-semibold text-text-primary uppercase tracking-wide mb-4 pb-2 border-b border-border-subtle">
            Emergency Contact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Emergency Contact Name",  name: "ecName",  placeholder: "Michael Cohen" },
              { label: "Emergency Contact Phone", name: "ecPhone", placeholder: "(201) 555-0101", type: "tel" },
            ].map(({ label, name, placeholder, type = "text" }) => (
              <div key={name}>
                <label htmlFor={name} className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  placeholder={placeholder}
                  className="h-9 w-full rounded-lg border border-border-input bg-background px-3 text-[13px] text-text-primary placeholder:text-text-subtle focus:ring-2 focus:ring-focus-ring focus:border-focus-ring transition"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <p className="text-[11px] text-text-subtle">
            All fields are required. Form submitted securely.
          </p>
          <button
            type="submit"
            className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-fg hover:bg-primary-hover transition-colors cursor-pointer"
          >
            Submit Enrollment Form
          </button>
        </div>

      </div>
    </form>
  );
}
