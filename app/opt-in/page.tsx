import type { Metadata } from "next";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";
import { LegalPageHeader } from "@/app/components/LegalPageHeader";

export const metadata: Metadata = {
  title: "SMS Opt-In Documentation — Kesher",
  description: "SMS opt-in process and consent documentation for Kesher School Communications",
};

const EFFECTIVE_DATE = "July 6, 2026";
const SUPPORT_EMAIL  = "help@kesherhq.co";
const COMPANY_NAME   = "Kesher";
const WEBSITE        = "https://www.kesherhq.co";

export default function OptInDocumentation() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-[860px] mx-auto w-full px-6 py-14">

        <LegalPageHeader
          title="SMS Opt-In Documentation"
          effectiveDate={EFFECTIVE_DATE}
          lastUpdated={EFFECTIVE_DATE}
        />

        <div className="text-[14px] text-zinc-600 space-y-12 leading-relaxed">

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              1. Purpose
            </h2>
            <p>
              This document describes the SMS opt-in process for the {COMPANY_NAME} school
              communications platform. It is intended to satisfy the opt-in documentation
              requirements of The Campaign Registry (TCR), US wireless carriers, CTIA
              Messaging Principles and Best Practices, and the Telephone Consumer Protection
              Act (TCPA).
            </p>
            <p className="mt-4">
              {COMPANY_NAME} operates an A2P (Application-to-Person) 10DLC SMS messaging
              platform. All SMS messages are sent on behalf of educational institutions
              (schools). Schools are the Message Originators and are solely responsible for
              collecting, documenting, and maintaining consent from their message recipients.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              2. Consent Model
            </h2>
            <p className="mb-4">
              Kesher uses a <strong>school-facilitated explicit single opt-in model</strong>.
              The consent chain operates as follows:
            </p>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white text-[12px] font-bold shrink-0 mt-0.5">1</div>
                <div>
                  <p className="font-semibold text-zinc-800 mb-1">School Collects Consent</p>
                  <p>
                    The school (Message Originator) collects explicit written or digital SMS
                    consent directly from the recipient via an enrollment form, parent portal,
                    onboarding document, or equivalent consent mechanism. The consent clearly
                    identifies the school as the sender, describes the message types, and
                    includes all required CTIA disclosures (message frequency, msg &amp; data
                    rates, opt-out instructions, privacy policy link).
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white text-[12px] font-bold shrink-0 mt-0.5">2</div>
                <div>
                  <p className="font-semibold text-zinc-800 mb-1">School Imports Contacts to Kesher</p>
                  <p>
                    The school administrator imports consented phone numbers into the Kesher
                    platform via CSV upload or manual entry. At the time of import, the
                    administrator is required to affirmatively certify that all imported contacts
                    have provided explicit consent to receive SMS messages from the school.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white text-[12px] font-bold shrink-0 mt-0.5">3</div>
                <div>
                  <p className="font-semibold text-zinc-800 mb-1">Kesher Records and Processes Consent</p>
                  <p>
                    Upon import, Kesher records the timestamp, importing administrator, and
                    the certification acknowledgment in its database. This creates an auditable
                    record that consent was certified at the time of import.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white text-[12px] font-bold shrink-0 mt-0.5">4</div>
                <div>
                  <p className="font-semibold text-zinc-800 mb-1">Messages Are Sent</p>
                  <p>
                    School administrators compose and send SMS campaigns through Kesher to
                    consented recipients. Kesher automatically appends "Reply STOP to opt out."
                    to every outbound SMS message.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white text-[12px] font-bold shrink-0 mt-0.5">5</div>
                <div>
                  <p className="font-semibold text-zinc-800 mb-1">Opt-Outs Are Processed Immediately</p>
                  <p>
                    Any recipient who replies STOP (or another recognized opt-out keyword)
                    is immediately removed from all future messaging for that school. The
                    opt-out is recorded in Kesher's suppression list and is permanent unless
                    the recipient re-subscribes by replying UNSTOP or START.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              3. Opt-In Verification
            </h2>
            <p>
              Kesher's platform enforces the following technical controls to prevent
              messaging of non-consented recipients:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2.5 mt-4">
              <li>
                <strong>Import certification gate:</strong> School administrators cannot
                complete a contact import without affirmatively clicking a certification
                checkbox confirming that all imported contacts have consented.
              </li>
              <li>
                <strong>Opted-out suppression:</strong> Kesher automatically checks every
                recipient against its suppression list before sending any message. Opted-out
                phone numbers are silently skipped and are never re-messaged.
              </li>
              <li>
                <strong>STOP keyword processing:</strong> Inbound STOP, STOPALL, UNSUBSCRIBE,
                CANCEL, END, and QUIT replies are processed automatically and in real time,
                with no manual intervention required.
              </li>
              <li>
                <strong>Audit trail:</strong> All import events, certification acknowledgments,
                and opt-out records are stored with timestamps and administrator identity.
              </li>
            </ul>
          </section>

          <section className="border border-zinc-200 rounded-xl p-6 bg-zinc-50">
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-5 tracking-tight">
              4. Automated Keyword Responses
            </h2>
            <p className="mb-5">
              The following automated responses are sent by Kesher for standard messaging keywords:
            </p>

            <div className="space-y-4">
              <div className="border border-zinc-200 rounded-lg bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  STOP Response (opt-out confirmation)
                </p>
                <p className="text-[14px] text-zinc-700 italic">
                  "You have been unsubscribed from [School Name] via Kesher. No further messages
                  will be sent to this number. Reply UNSTOP to re-subscribe."
                </p>
              </div>

              <div className="border border-zinc-200 rounded-lg bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  HELP Response (support information)
                </p>
                <p className="text-[14px] text-zinc-700 italic">
                  "[School Name] via Kesher School Comms. For support: {SUPPORT_EMAIL}
                  or {WEBSITE}. Msg &amp; data rates may apply. Reply STOP to opt out."
                </p>
              </div>

              <div className="border border-zinc-200 rounded-lg bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  UNSTOP / START Response (re-subscribe confirmation)
                </p>
                <p className="text-[14px] text-zinc-700 italic">
                  "You have been re-subscribed to [School Name] via Kesher. Messages will
                  resume. Msg &amp; data rates may apply. Reply STOP to opt out at any time."
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              5. Consent Record Keeping
            </h2>
            <p>
              Consent records are maintained as follows:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2.5 mt-4">
              <li>
                <strong>School-side records:</strong> The school is responsible for maintaining
                the original consent documentation (enrollment forms, digital opt-in records,
                etc.) and must provide these records upon request.
              </li>
              <li>
                <strong>Kesher import records:</strong> Kesher records the import timestamp,
                administrator identity, and certification acknowledgment for every contact
                import event.
              </li>
              <li>
                <strong>Opt-out records:</strong> Kesher retains a permanent suppression list
                of all opted-out phone numbers. These records are never deleted and are applied
                globally to prevent re-messaging.
              </li>
              <li>
                <strong>Inbound message logs:</strong> Kesher records all inbound messages
                (including STOP, HELP, and UNSTOP replies) with timestamps for compliance
                audit purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              6. Message Footer
            </h2>
            <p>
              Kesher automatically appends the following opt-out footer to every outbound
              SMS message:
            </p>
            <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50 mt-4">
              <p className="text-[14px] text-zinc-700 font-mono">Reply STOP to opt out.</p>
            </div>
            <p className="mt-4">
              This footer is appended automatically and cannot be removed by school
              administrators, ensuring that every recipient is aware of their right to
              opt out at any time.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              7. Prohibited Practices
            </h2>
            <p className="mb-4">
              Kesher's Terms of Service explicitly prohibit the following:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>Sending SMS messages to recipients who have not explicitly consented</li>
              <li>Importing phone numbers sourced from purchased lists, web scraping, or any non-consented source</li>
              <li>Re-messaging recipients who have opted out</li>
              <li>Sending unsolicited commercial messages, spam, or marketing content unrelated to school communications</li>
              <li>Misrepresenting the sender identity or content of messages</li>
            </ul>
            <p className="mt-4">
              Violations of these policies may result in immediate account suspension and
              removal from the Kesher platform.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              8. Compliance References
            </h2>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>CTIA Messaging Principles and Best Practices (current edition)</li>
              <li>The Campaign Registry (TCR) A2P 10DLC requirements</li>
              <li>Telephone Consumer Protection Act (TCPA), 47 U.S.C. § 227</li>
              <li>CAN-SPAM Act of 2003</li>
              <li>Family Educational Rights and Privacy Act (FERPA)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              9. Related Documents
            </h2>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>
                <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>{" "}
                — describes how Kesher handles personal data including phone numbers and SMS consent
              </li>
              <li>
                <a href="/sms-terms" className="underline underline-offset-2">SMS Terms &amp; Conditions</a>{" "}
                — recipient-facing terms governing the SMS messaging program
              </li>
              <li>
                <a href="/terms" className="underline underline-offset-2">Terms of Service</a>{" "}
                — school administrator agreement governing use of the Kesher platform
              </li>
              <li>
                <a href="/cta" className="underline underline-offset-2">Call-to-Action Documentation</a>{" "}
                — sample CTA language and opt-in flow description
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              10. Contact
            </h2>
            <p>
              For questions about this documentation or Kesher's SMS compliance program:
            </p>
            <address className="not-italic mt-4 space-y-1.5">
              <p><strong>{COMPANY_NAME}</strong></p>
              <p>
                Email:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>
              </p>
              <p>
                Website:{" "}
                <a href={WEBSITE} className="underline underline-offset-2">{WEBSITE}</a>
              </p>
            </address>
          </section>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
