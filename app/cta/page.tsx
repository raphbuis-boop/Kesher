import type { Metadata } from "next";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";
import { LegalPageHeader } from "@/app/components/LegalPageHeader";

export const metadata: Metadata = {
  title: "Call-to-Action Documentation — Kesher",
  description: "SMS Call-to-Action and consent documentation for Kesher School Communications",
};

const EFFECTIVE_DATE = "July 6, 2026";
const SUPPORT_EMAIL  = "help@kesherhq.co";
const COMPANY_NAME   = "Kesher";
const WEBSITE        = "https://www.kesherhq.co";

export default function CtaDocumentation() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-[860px] mx-auto w-full px-6 py-14">

        <LegalPageHeader
          title="Call-to-Action (CTA) Documentation"
          effectiveDate={EFFECTIVE_DATE}
          lastUpdated={EFFECTIVE_DATE}
        />

        <div className="text-[14px] text-zinc-600 space-y-12 leading-relaxed">

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              1. Program Overview
            </h2>
            <p>
              {COMPANY_NAME} ("{COMPANY_NAME}") operates an A2P (Application-to-Person) SMS
              messaging platform designed exclusively for educational institutions. Schools use
              Kesher to communicate with their communities — including parents, guardians,
              students, staff, alumni, and other authorized school community members.
            </p>
            <p className="mt-4">
              Kesher operates as a messaging service provider on behalf of individual schools.
              Each school is the Message Originator responsible for obtaining, documenting, and
              maintaining consent from message recipients before importing contact information
              into the Kesher platform.
            </p>
            <p className="mt-4">
              All SMS messages sent through Kesher are transactional or informational school
              communications. Kesher does not send marketing or promotional messages on its
              own behalf.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              2. Opt-In Method
            </h2>
            <p className="mb-4">
              Kesher uses a <strong>school-facilitated explicit opt-in model</strong>.
              Consent is obtained by the school (Message Originator) directly from each
              recipient prior to that recipient's phone number being imported into Kesher.
              The following methods are used:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-3">
              <li>
                <strong>Annual Enrollment / Re-Enrollment Forms:</strong> Schools include a
                written or digital SMS consent checkbox on student enrollment and annual
                re-enrollment forms. The checkbox explicitly states the school's intent to
                send SMS messages via the Kesher platform.
              </li>
              <li>
                <strong>Emergency Contact Update Forms:</strong> Schools collect updated phone
                numbers and SMS consent through emergency contact update forms distributed
                annually or at key school events.
              </li>
              <li>
                <strong>School Website / Parent Portal Registration:</strong> Schools with
                online portals include an SMS opt-in checkbox during account creation or
                profile updates.
              </li>
              <li>
                <strong>Staff and Faculty Onboarding:</strong> New staff and faculty provide
                SMS consent as part of the hiring or onboarding process.
              </li>
            </ul>
          </section>

          <section className="border border-zinc-200 rounded-xl p-6 bg-zinc-50">
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-5 tracking-tight">
              3. Sample Call-to-Action Language
            </h2>
            <p className="mb-5">
              The following is the recommended call-to-action (CTA) language that Kesher
              provides to schools for use on enrollment forms, parent portals, and other
              consent-collection surfaces. Schools are required to use language substantially
              similar to the following before importing phone numbers into Kesher:
            </p>

            <div className="border border-zinc-300 rounded-lg p-5 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Sample CTA — Enrollment Form
              </p>
              <p className="text-[14px] text-zinc-700 leading-relaxed">
                ☐ <strong>I consent to receive SMS text messages</strong> from{" "}
                <em>[School Name]</em> via Kesher, our school communications platform. Messages may
                include school announcements, emergency alerts, event reminders, attendance
                updates, and other school-related communications. Message frequency varies.
                Message and data rates may apply. Reply <strong>STOP</strong> to opt out at any
                time. Reply <strong>HELP</strong> for help. View our privacy policy at{" "}
                <span className="underline">{WEBSITE}/privacy</span>.
              </p>
            </div>

            <div className="border border-zinc-300 rounded-lg p-5 bg-white mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Sample CTA — School Website / Parent Portal
              </p>
              <p className="text-[14px] text-zinc-700 leading-relaxed">
                ☐ <strong>Text Alerts:</strong> I agree to receive text (SMS) messages from{" "}
                <em>[School Name]</em> to the mobile number provided above. These messages
                are sent through Kesher, a school communications platform, and may include
                important school announcements, emergency notifications, event reminders, and
                attendance alerts. Msg &amp; data rates may apply. Frequency varies by school
                activity. You may opt out at any time by replying <strong>STOP</strong>.
                For support, reply <strong>HELP</strong> or contact{" "}
                <span className="underline">{SUPPORT_EMAIL}</span>.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              4. Required CTA Elements
            </h2>
            <p className="mb-4">
              All school-facing CTAs used to collect SMS consent must include the following
              elements, consistent with CTIA Messaging Principles and Best Practices and
              TCPA requirements:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2.5">
              <li>Identity of the message sender (school name and/or Kesher)</li>
              <li>Description of the types of messages to be received</li>
              <li>Disclosure that message and data rates may apply</li>
              <li>Disclosure of message frequency or that frequency varies</li>
              <li>Instructions for opting out (STOP keyword)</li>
              <li>Instructions for getting help (HELP keyword or support contact)</li>
              <li>Link to privacy policy</li>
              <li>Statement that consent is not a condition of purchase or enrollment</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              5. Import Certification
            </h2>
            <p>
              Before importing any phone number list into Kesher, school administrators
              must affirmatively certify the following:
            </p>
            <div className="border border-zinc-200 rounded-xl p-5 bg-zinc-50 mt-4">
              <p className="text-[14px] text-zinc-700 leading-relaxed italic">
                "By importing these contacts, I certify that all individuals on this list have
                provided explicit, written or digital consent to receive SMS text messages from
                our school via the Kesher platform. I acknowledge that it is the school's
                responsibility to maintain accurate consent records and to honor all opt-out
                requests in accordance with TCPA and CTIA guidelines."
              </p>
            </div>
            <p className="mt-4">
              Kesher enforces this certification requirement at the time of every contact
              import. Schools that cannot provide this certification may not import
              those contacts for SMS messaging.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              6. Message Types
            </h2>
            <p className="mb-4">
              Messages sent through the Kesher platform are limited to the following
              school communications use cases:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>Emergency alerts and safety notifications</li>
              <li>School event announcements and reminders</li>
              <li>Attendance and absence notifications</li>
              <li>Administrative announcements from school leadership</li>
              <li>Schedule changes and closures</li>
              <li>Fundraising and community event information</li>
              <li>General school community communications</li>
            </ul>
            <p className="mt-4">
              Kesher does not support or permit the sending of marketing, promotional,
              political, or unsolicited commercial messages through its platform.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              7. Sample Messages
            </h2>
            <p className="mb-5">
              The following are representative examples of messages sent through the
              Kesher platform on behalf of schools:
            </p>
            <div className="space-y-4">
              <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Sample Message 1 — Event Reminder
                </p>
                <p className="text-[14px] text-zinc-700">
                  [School Name]: Parent-Teacher conferences are tomorrow, Thu 3/20, 4–8 PM.
                  Sign up at school.edu/conferences. Reply STOP to opt out.
                </p>
              </div>
              <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Sample Message 2 — Emergency Alert
                </p>
                <p className="text-[14px] text-zinc-700">
                  [School Name] ALERT: School will be closed tomorrow, Fri 1/17, due to inclement
                  weather. All after-school programs are also cancelled. Stay safe.
                  Reply STOP to opt out.
                </p>
              </div>
              <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Sample Message 3 — General Announcement
                </p>
                <p className="text-[14px] text-zinc-700">
                  [School Name]: Registration for the 2025–26 school year opens next Monday.
                  Visit school.edu/register or contact the office at 555-000-0000.
                  Reply STOP to opt out.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              8. Opt-Out Processing
            </h2>
            <p>
              Kesher processes opt-out requests in real time. When a recipient replies
              STOP (or any recognized opt-out keyword), the system immediately:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2 mt-4">
              <li>Marks the phone number as opted-out in the Kesher database</li>
              <li>Sends a single confirmation message: <em>"You have been unsubscribed from
                [School Name] via Kesher. No further messages will be sent to this number.
                Reply UNSTOP to re-subscribe."</em></li>
              <li>Suppresses that number from all future sends for that school</li>
              <li>Records the opt-out timestamp and keyword received</li>
            </ul>
            <p className="mt-4">
              Recognized opt-out keywords: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT.
            </p>
            <p className="mt-4">
              Opt-out records are retained indefinitely to prevent re-messaging opted-out
              recipients.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              9. HELP Response
            </h2>
            <p>
              When a recipient replies HELP, the system automatically sends the following
              response:
            </p>
            <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50 mt-4">
              <p className="text-[14px] text-zinc-700 italic">
                "[School Name] via Kesher School Comms. For support: {SUPPORT_EMAIL} or
                {WEBSITE}. Msg &amp; data rates may apply. Reply STOP to opt out."
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              10. Privacy and Data Handling
            </h2>
            <p>
              No mobile information will be shared with third parties or affiliates for
              marketing or promotional purposes. Text messaging originator opt-in data and
              consent will not be shared with any third parties.
            </p>
            <p className="mt-4">
              For complete privacy information, see our{" "}
              <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a> and{" "}
              <a href="/sms-terms" className="underline underline-offset-2">SMS Terms &amp; Conditions</a>.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              11. Contact
            </h2>
            <address className="not-italic space-y-1.5">
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
