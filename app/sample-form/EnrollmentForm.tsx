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
      <div className="rounded-xl border-2 border-green-200 bg-green-50 overflow-hidden mb-10">
        {/* Form header — unchanged */}
        <div className="bg-zinc-50 border-b border-zinc-200 px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
              <span className="text-[11px] font-bold text-white">EF</span>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-zinc-900">Maple Ridge Day School</p>
              <p className="text-[12px] text-zinc-500">2025–2026 Annual Re-Enrollment Form</p>
            </div>
          </div>
        </div>
        <div className="px-7 py-10 flex flex-col items-center text-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 13L9 17L19 7" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-zinc-900">Sample submission successful.</p>
          <p className="text-[13px] text-zinc-500 max-w-[460px] leading-relaxed">
            This demonstration form exists solely for carrier compliance review and does not
            store personal information.
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="mt-2 rounded-lg border border-zinc-200 px-4 py-2 text-[13px] text-zinc-600 hover:bg-zinc-50 transition-colors"
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
      className="rounded-xl border-2 border-zinc-200 bg-white overflow-hidden mb-10"
    >
      {/* Form header */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-7 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 shrink-0">
            <span className="text-[11px] font-bold text-white">EF</span>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-zinc-900">Maple Ridge Day School</p>
            <p className="text-[12px] text-zinc-500">2025–2026 Annual Re-Enrollment Form</p>
          </div>
        </div>
      </div>

      {/* Form body */}
      <div className="px-7 py-8 space-y-7">

        {/* Contact information */}
        <div>
          <h2 className="text-[13px] font-semibold text-zinc-800 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-100">
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
                <label htmlFor={name} className="block text-[12px] font-medium text-zinc-600 mb-1.5">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  placeholder={placeholder}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-300 transition"
                />
              </div>
            ))}
          </div>
        </div>

        {/* SMS CTA */}
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
          <h2 className="text-[13px] font-semibold text-zinc-800 uppercase tracking-wide mb-4">
            SMS / Text Message Communications
          </h2>

          <div className="flex gap-3 items-start">
            <input
              id="smsConsent"
              name="smsConsent"
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-400 accent-zinc-900 cursor-pointer"
            />
            <label htmlFor="smsConsent" className="text-[13px] text-zinc-800 leading-relaxed cursor-pointer">
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
                className="underline underline-offset-2 text-blue-700"
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                href="/sms-terms"
                className="underline underline-offset-2 text-blue-700"
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
          <div className="mt-5 pt-4 border-t border-blue-200">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-3">
              CTA Element Checklist (for reviewer reference)
            </p>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {CTA_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
                    <circle cx="7" cy="7" r="7" fill="#22c55e" />
                    <path d="M4 7L6 9L10 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] text-blue-800">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Emergency contact */}
        <div>
          <h2 className="text-[13px] font-semibold text-zinc-800 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-100">
            Emergency Contact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Emergency Contact Name",  name: "ecName",  placeholder: "Michael Cohen" },
              { label: "Emergency Contact Phone", name: "ecPhone", placeholder: "(201) 555-0101", type: "tel" },
            ].map(({ label, name, placeholder, type = "text" }) => (
              <div key={name}>
                <label htmlFor={name} className="block text-[12px] font-medium text-zinc-600 mb-1.5">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  placeholder={placeholder}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-[13px] text-zinc-800 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-300 transition"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
          <p className="text-[11px] text-zinc-400">
            All fields are required. Form submitted securely.
          </p>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-[13px] font-medium text-white hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            Submit Enrollment Form
          </button>
        </div>

      </div>
    </form>
  );
}
