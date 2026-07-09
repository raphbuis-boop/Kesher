import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";

export const metadata: Metadata = {
  title: "Sample School Enrollment SMS Opt-In Form — Kesher",
  description:
    "A representative sample of the SMS consent opt-in language used on school enrollment forms in the Kesher messaging platform. Provided for carrier compliance review.",
};

const SUPPORT_EMAIL = "help@kesherhq.co";
const WEBSITE = "https://www.kesherhq.co";

export default function SampleFormPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-[860px] mx-auto w-full px-6 py-14">

        {/* ── Reviewer notice ─────────────────────────────────────────── */}
        <div className="mb-10 rounded-xl border border-blue-200 bg-blue-50 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 mb-1">
            For Carrier &amp; Compliance Reviewers
          </p>
          <p className="text-[13px] text-blue-800 leading-relaxed">
            This page demonstrates the compliant call-to-action (CTA) language that Kesher
            provides to schools for use on their enrollment forms and parent portals. It
            represents what a parent or guardian sees when providing SMS consent to receive
            school communications. This is the opt-in point-of-consent form for the Kesher
            A2P 10DLC SMS program.
          </p>
          <p className="text-[12px] text-blue-700 mt-2">
            Full documentation:{" "}
            <Link href="/cta" className="underline underline-offset-2">CTA Documentation</Link>
            {" "}·{" "}
            <Link href="/opt-in" className="underline underline-offset-2">Opt-In Documentation</Link>
            {" "}·{" "}
            <Link href="/sms-terms" className="underline underline-offset-2">SMS Terms</Link>
            {" "}·{" "}
            <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
          </p>
        </div>

        {/* ── Page heading ────────────────────────────────────────────── */}
        <div className="mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Sample Opt-In Form
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-3">
            School Enrollment SMS Consent
          </h1>
          <p className="text-[14px] text-zinc-500 leading-relaxed max-w-[600px]">
            The following is a representative example of how a school collects SMS consent
            from parents and guardians using the Kesher platform. Schools are required to
            use language substantially similar to this before importing phone numbers.
          </p>
        </div>

        {/* ── The sample enrollment form ───────────────────────────────── */}
        <div className="rounded-xl border-2 border-zinc-200 bg-white overflow-hidden mb-10">

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

            {/* Contact information section */}
            <div>
              <h2 className="text-[13px] font-semibold text-zinc-800 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-100">
                Parent / Guardian Contact Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "First Name", placeholder: "Rachel" },
                  { label: "Last Name",  placeholder: "Cohen"  },
                  { label: "Email Address", placeholder: "rachel.cohen@example.com", col: "sm:col-span-2" },
                  { label: "Mobile Phone Number", placeholder: "(201) 555-0100", col: "sm:col-span-2" },
                  { label: "Student Name", placeholder: "David Cohen" },
                  { label: "Grade (2025–2026)", placeholder: "7th Grade" },
                ].map(({ label, placeholder, col }) => (
                  <div key={label} className={col ?? ""}>
                    <label className="block text-[12px] font-medium text-zinc-600 mb-1.5">
                      {label}
                    </label>
                    <div className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 flex items-center">
                      <span className="text-[13px] text-zinc-300">{placeholder}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── THE COMPLIANT SMS CTA ── */}
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6">
              <h2 className="text-[13px] font-semibold text-zinc-800 uppercase tracking-wide mb-4">
                SMS / Text Message Communications
              </h2>

              {/* The opt-in checkbox and disclosure */}
              <div className="flex gap-3 items-start">
                {/* Checkbox (visual only) */}
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-400 bg-blue-500">
                  {/* Checkmark SVG */}
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                    <path d="M1 4.5L4 7.5L10 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Disclosure text */}
                <div>
                  <p className="text-[13px] text-zinc-800 leading-relaxed">
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
                  </p>
                </div>
              </div>

              {/* CTA element checklist — visible for reviewer context */}
              <div className="mt-5 pt-4 border-t border-blue-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-3">
                  CTA Element Checklist (for reviewer reference)
                </p>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {[
                    "Brand name: Maple Ridge Day School via Kesher",
                    "Message types described",
                    "Message frequency: varies",
                    "Msg & data rates may apply",
                    "STOP opt-out instructions",
                    "HELP support instructions",
                    "Privacy Policy link",
                    "SMS Terms & Conditions link",
                    "Not a condition of enrollment",
                  ].map((item) => (
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

            {/* Additional fields below CTA */}
            <div>
              <h2 className="text-[13px] font-semibold text-zinc-800 uppercase tracking-wide mb-4 pb-2 border-b border-zinc-100">
                Emergency Contact
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Emergency Contact Name", placeholder: "Michael Cohen" },
                  { label: "Emergency Contact Phone", placeholder: "(201) 555-0101" },
                ].map(({ label, placeholder }) => (
                  <div key={label}>
                    <label className="block text-[12px] font-medium text-zinc-600 mb-1.5">
                      {label}
                    </label>
                    <div className="h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 flex items-center">
                      <span className="text-[13px] text-zinc-300">{placeholder}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <p className="text-[11px] text-zinc-400">
                All fields are required. Form submitted securely.
              </p>
              <div className="rounded-lg bg-zinc-900 px-5 py-2.5 inline-flex items-center">
                <span className="text-[13px] font-medium text-white">Submit Enrollment Form</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── What the school admin sees ───────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
            What Happens After the Form Is Submitted
          </h2>
          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "School exports consented numbers",
                body: "After enrollment forms are collected, the school administrator exports the phone numbers of consented parents and guardians into a CSV file.",
              },
              {
                step: "2",
                title: "Administrator imports to Kesher with certification",
                body: "The administrator uploads the CSV to Kesher. Before any numbers are saved, they must check a certification box confirming that all contacts have explicitly consented to receive SMS from the school.",
              },
              {
                step: "3",
                title: "Kesher records the import and consent certification",
                body: "Kesher logs the import timestamp, the administrator's identity, and the certification acknowledgment. This creates an auditable consent trail.",
              },
              {
                step: "4",
                title: "School sends messages; STOP/HELP handled automatically",
                body: "School administrators send campaigns through Kesher. Every message automatically includes opt-out instructions. STOP, HELP, and UNSTOP are processed in real time with no manual intervention.",
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white text-[12px] font-bold shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-zinc-800 mb-1">{title}</p>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Web / parent portal variant ─────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-2 tracking-tight">
            Alternative: Online Parent Portal Opt-In
          </h2>
          <p className="text-[13px] text-zinc-500 mb-5 leading-relaxed">
            Schools with online parent portals or re-enrollment websites use the following
            CTA language on their digital registration page:
          </p>

          <div className="rounded-xl border-2 border-zinc-200 bg-white overflow-hidden">
            <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4">
              <p className="text-[12px] font-semibold text-zinc-600">
                Online Parent Portal — Account Registration
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">portal.mappleridgedayschool.edu / Account Setup</p>
            </div>
            <div className="px-6 py-6">
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-zinc-300 bg-white">
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-zinc-700 mb-1">
                    Text Alerts — Optional
                  </p>
                  <p className="text-[13px] text-zinc-600 leading-relaxed">
                    I agree to receive text (SMS) messages from{" "}
                    <strong>Maple Ridge Day School</strong> to the mobile number provided
                    above. These messages are sent through{" "}
                    <strong>Kesher</strong>, a school communications platform, and may
                    include important school announcements, emergency notifications, event
                    reminders, and attendance alerts. Msg &amp; data rates may apply.
                    Frequency varies by school activity. Reply <strong>STOP</strong> to
                    opt out at any time. For support, reply <strong>HELP</strong> or
                    contact{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 text-blue-600">
                      {SUPPORT_EMAIL}
                    </a>
                    . View our{" "}
                    <Link href="/privacy" className="underline underline-offset-2 text-blue-600">
                      Privacy Policy
                    </Link>
                    {" "}and{" "}
                    <Link href="/sms-terms" className="underline underline-offset-2 text-blue-600">
                      SMS Terms
                    </Link>
                    .{" "}
                    <strong>
                      Consent is not a condition of enrollment or any purchase.
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Keyword response reference ───────────────────────────────── */}
        <div className="mb-10">
          <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
            Automated Keyword Responses
          </h2>
          <div className="space-y-3">
            {[
              {
                keyword: "STOP",
                label: "Opt-Out Confirmation",
                response:
                  "[Maple Ridge Day School] via Kesher: You have been unsubscribed. No further messages will be sent to this number. Reply UNSTOP to re-subscribe.",
              },
              {
                keyword: "HELP",
                label: "Support Response",
                response: `[Maple Ridge Day School] via Kesher School Comms. For support: ${SUPPORT_EMAIL} or ${WEBSITE}. Msg & data rates may apply. Reply STOP to opt out.`,
              },
              {
                keyword: "UNSTOP",
                label: "Re-Subscribe Confirmation",
                response:
                  "[Maple Ridge Day School] via Kesher: You have been re-subscribed. Messages will resume. Msg & data rates may apply. Reply STOP to opt out at any time.",
              },
            ].map(({ keyword, label, response }) => (
              <div key={keyword} className="rounded-lg border border-zinc-200 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white font-mono">
                    {keyword}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    {label}
                  </span>
                </div>
                <p className="text-[13px] text-zinc-700 italic leading-relaxed">&ldquo;{response}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contact ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            Contact for Compliance Questions
          </p>
          <p className="text-[13px] text-zinc-700 mb-1">
            <strong>Kesher</strong>
          </p>
          <p className="text-[13px] text-zinc-600">
            Email:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="text-[13px] text-zinc-600 mt-1">
            Website:{" "}
            <a href={WEBSITE} className="underline underline-offset-2">
              {WEBSITE}
            </a>
          </p>
        </div>

      </main>

      <PublicFooter />
    </div>
  );
}
