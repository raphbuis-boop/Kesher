import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";

export const metadata: Metadata = {
  title: "SMS Terms & Conditions — Kesher",
  description: "SMS Terms and Conditions for Kesher School Communications",
};

const EFFECTIVE_DATE = "July 6, 2026";
const SUPPORT_EMAIL  = "help@kesherhq.co";
const COMPANY_NAME   = "Kesher";
const WEBSITE        = "https://www.kesherhq.co";

export default function SmsTerms() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">SMS Terms &amp; Conditions</h1>
        <p className="text-sm text-zinc-500 mb-8">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="text-sm text-zinc-700 space-y-8">

          {/* Program description */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Program Description</h2>
            <p>
              {COMPANY_NAME} ("{COMPANY_NAME}") provides a school communications platform that
              enables educational institutions to send SMS text messages to their communities
              — including parents, guardians, students, staff, alumni, and other authorized
              school community members.
            </p>
            <p className="mt-3">
              Messages sent through Kesher may include: school event notifications, emergency
              alerts, attendance reminders, administrative announcements, schedule updates,
              fundraising information, and general school communications. Messages are sent
              on behalf of your school. The school name or identifier will be included in
              each message.
            </p>
          </section>

          {/* Consent */}
          <section className="border border-zinc-200 rounded-lg p-5 bg-zinc-50">
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Consent to Receive Messages</h2>
            <p>
              You are receiving SMS messages because your school has your phone number on file
              and has indicated that you have consented to receive communications from your
              school community. Your school is responsible for obtaining and maintaining
              appropriate consent from its community members.
            </p>
            <p className="mt-3">
              By not opting out, you confirm that you consent to receive SMS text messages
              from your school via the Kesher platform. Consent is not a condition of any
              purchase or enrollment.
            </p>
          </section>

          {/* Frequency */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Message Frequency</h2>
            <p>
              Message frequency varies based on your school's activity and communication needs.
              You may receive multiple messages per week during active school periods.
            </p>
          </section>

          {/* Costs */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Message and Data Rates</h2>
            <p>
              <strong>Message and data rates may apply.</strong> Please check with your mobile
              service provider for details about your plan's SMS rates. {COMPANY_NAME} and your
              school do not charge a fee for SMS messages, but your carrier may.
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Participating carriers include AT&amp;T, T-Mobile, Verizon, and others. Carrier
              availability and rates may vary. Carriers are not liable for delayed or undelivered
              messages.
            </p>
          </section>

          {/* Opt-out */}
          <section className="border-l-4 border-zinc-900 pl-4">
            <h2 className="text-base font-semibold text-zinc-900 mb-3">How to Opt Out (STOP)</h2>
            <p>
              You may opt out of SMS messages at any time by replying{" "}
              <strong>STOP</strong> to any text message. After opting out, you will receive
              one final confirmation message and no further messages will be sent to your number.
            </p>
            <p className="mt-3">
              Opt-out requests are processed immediately. STOP, STOPALL, UNSUBSCRIBE, CANCEL,
              END, and QUIT are all recognized opt-out keywords.
            </p>
            <p className="mt-3">
              To re-subscribe after opting out, reply <strong>UNSTOP</strong> or{" "}
              <strong>START</strong>.
            </p>
          </section>

          {/* HELP */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">How to Get Help (HELP)</h2>
            <p>
              Reply <strong>HELP</strong> to any message to receive support contact information.
              You can also reach us at:
            </p>
            <address className="not-italic mt-3 space-y-1">
              <p>
                Email:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
              </p>
              <p>
                Website:{" "}
                <a href={WEBSITE} className="underline">{WEBSITE}</a>
              </p>
            </address>
            <p className="mt-3">
              For issues with messages from a specific school, please contact your school's
              administrative office directly.
            </p>
          </section>

          {/* Data */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Your Phone Number and Privacy</h2>
            <p>
              Your mobile phone number and SMS consent information will not be shared with
              third parties or affiliates for marketing or promotional purposes.
            </p>
            <p className="mt-3">
              Please review our full{" "}
              <Link href="/privacy" className="underline">Privacy Policy</Link>{" "}
              for complete details on how we collect, use, and protect your information.
            </p>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Limitation of Liability</h2>
            <p>
              {COMPANY_NAME} is not liable for any delays or failures in the receipt of SMS
              messages. Delivery is subject to valid mobile service coverage and carrier network
              conditions. Carriers reserve the right to refuse, alter, or terminate any SMS
              service at any time.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Changes to These Terms</h2>
            <p>
              We may update these SMS Terms from time to time. Material changes will be communicated
              through the platform or by email to school administrators. Continued use of the
              messaging service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Contact</h2>
            <address className="not-italic space-y-1">
              <p><strong>{COMPANY_NAME}</strong></p>
              <p>
                Email:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>
              </p>
              <p>
                Website:{" "}
                <a href={WEBSITE} className="underline">{WEBSITE}</a>
              </p>
            </address>
          </section>

          {/* Quick reference */}
          <section className="border border-zinc-200 rounded-lg p-5">
            <h2 className="text-base font-semibold text-zinc-900 mb-4">Quick Reference</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-zinc-50 rounded-md p-3">
                <p className="font-semibold text-zinc-800">STOP</p>
                <p className="text-zinc-500 text-xs mt-0.5">Opt out of all messages</p>
              </div>
              <div className="bg-zinc-50 rounded-md p-3">
                <p className="font-semibold text-zinc-800">UNSTOP / START</p>
                <p className="text-zinc-500 text-xs mt-0.5">Re-subscribe to messages</p>
              </div>
              <div className="bg-zinc-50 rounded-md p-3">
                <p className="font-semibold text-zinc-800">HELP</p>
                <p className="text-zinc-500 text-xs mt-0.5">Get support information</p>
              </div>
              <div className="bg-zinc-50 rounded-md p-3">
                <p className="font-semibold text-zinc-800">Msg &amp; Data Rates May Apply</p>
                <p className="text-zinc-500 text-xs mt-0.5">Check with your carrier</p>
              </div>
            </div>
          </section>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
