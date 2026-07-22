import type { Metadata } from "next";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";
import { LegalPageHeader } from "@/app/components/LegalPageHeader";

export const metadata: Metadata = {
  title: "Privacy Policy — Kesher",
  description: "Privacy Policy for Kesher School Communications Platform",
};

const EFFECTIVE_DATE = "July 6, 2026";
const CONTACT_EMAIL  = "contact@kesherhq.co";
const COMPANY_NAME   = "Kesher";
const WEBSITE        = "https://www.kesherhq.co";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-[860px] mx-auto w-full px-6 py-14">

        <LegalPageHeader
          title="Privacy Policy"
          effectiveDate={EFFECTIVE_DATE}
          lastUpdated={EFFECTIVE_DATE}
        />

        <div className="text-[14px] text-zinc-600 space-y-12 leading-relaxed">

          {/* 1. Introduction */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              1. About This Policy
            </h2>
            <p>
              Kesher is a product of La Voral LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). This Privacy Policy explains how we collect, use, and protect your information.
            </p>
            <p className="mt-4">
              {COMPANY_NAME} operates a school
              communications platform that enables educational institutions to communicate with
              their communities via email, SMS, and WhatsApp. This Privacy Policy explains how we
              collect, use, share, and protect information when schools and their authorized
              administrators ("School Users") use the Kesher platform, and when members of a
              school community ("Recipients") receive communications sent through Kesher.
            </p>
            <p className="mt-4">
              By using our platform or receiving messages sent through it, you acknowledge this
              Privacy Policy. If you are a School User, your use of Kesher is also governed by
              your school's agreement with us.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              2. Information We Collect
            </h2>

            <h3 className="text-[13px] font-semibold text-zinc-800 mb-3">From School Administrators</h3>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>Name, email address, and login credentials</li>
              <li>School name, address, and contact information</li>
              <li>Billing and subscription information</li>
              <li>Usage data and activity logs within the platform</li>
            </ul>

            <h3 className="text-[13px] font-semibold text-zinc-800 mt-6 mb-3">
              From School Community Members (Recipients)
            </h3>
            <p className="mb-3">
              Schools import contact information for their communities into Kesher. This may include:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>Full name</li>
              <li>Email address</li>
              <li>Mobile phone number (used for SMS and WhatsApp messaging)</li>
              <li>Relationship to the school (e.g., parent, student, staff, alumni)</li>
              <li>Graduation year or grade level</li>
              <li>Mailing address</li>
            </ul>

            <h3 className="text-[13px] font-semibold text-zinc-800 mt-6 mb-3">
              Automatically Collected Information
            </h3>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>Message delivery status and timestamps (delivered, opened, clicked, replied)</li>
              <li>Opt-in and opt-out records for SMS messaging</li>
              <li>IP addresses and device information for security purposes</li>
              <li>Log data from platform usage</li>
            </ul>
          </section>

          {/* 3. How We Use Information */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>To transmit communications on behalf of schools to their authorized Recipients</li>
              <li>To track message delivery, engagement, and analytics for school administrators</li>
              <li>To process opt-out requests and maintain suppression lists</li>
              <li>To provide customer support and respond to inquiries</li>
              <li>To improve and secure the platform</li>
              <li>To comply with legal obligations, including carrier and regulatory requirements</li>
            </ul>
          </section>

          {/* 4. SMS Messaging — CRITICAL 10DLC SECTION */}
          <section className="border border-zinc-200 rounded-xl p-6 bg-zinc-50">
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-5 tracking-tight">
              4. SMS Text Messaging Program
            </h2>

            <h3 className="text-[13px] font-semibold text-zinc-800 mb-3">Program Description</h3>
            <p>
              Kesher enables schools to send SMS text messages to parents, guardians, students,
              staff, alumni, and other authorized community members. Message types include school
              event notifications, emergency alerts, administrative announcements, attendance
              reminders, and general school communications. Messages are sent on behalf of
              individual schools; the school is responsible for obtaining appropriate consent from
              its community members before sending SMS through Kesher.
            </p>

            <h3 className="text-[13px] font-semibold text-zinc-800 mt-6 mb-3">SMS Consent</h3>
            <p>
              Recipients receive SMS messages because their school has their phone number on file
              and has determined they have consented to receive school communications. Message
              frequency varies based on school activity and needs. Schools are responsible for
              maintaining accurate consent records for their community.
            </p>

            <h3 className="text-[13px] font-semibold text-zinc-800 mt-6 mb-3">Message and Data Rates</h3>
            <p>
              Message and data rates may apply. Contact your mobile carrier for details.
            </p>

            <h3 className="text-[13px] font-semibold text-zinc-800 mt-6 mb-3">How to Opt Out of SMS</h3>
            <p>
              You may opt out of SMS messages at any time by replying{" "}
              <strong>STOP</strong> to any text message you receive. You will receive a single
              confirmation message and no further messages will be sent. To opt back in, reply{" "}
              <strong>UNSTOP</strong> or <strong>START</strong>. For help, reply <strong>HELP</strong>{" "}
              or contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>.
            </p>

            <h3 className="text-[13px] font-semibold text-zinc-800 mt-6 mb-3">SMS Data — Sharing Restrictions</h3>
            <p className="font-semibold text-zinc-800">
              No mobile information will be shared with third parties or affiliates for
              marketing or promotional purposes.
            </p>
            <p className="mt-3">
              All other categories of information described in this Privacy Policy exclude text
              messaging originator opt-in data and consent; this information will not be shared
              with any third parties.
            </p>
            <p className="mt-3">
              We do not sell, rent, or lease mobile phone numbers or SMS consent records to any
              third party. We do not use phone numbers collected through SMS opt-in for any purpose
              other than delivering school communications on behalf of the school that collected
              the number.
            </p>

            <h3 className="text-[13px] font-semibold text-zinc-800 mt-6 mb-3">Supported Keywords</h3>
            <div className="space-y-2">
              <p><strong>STOP</strong> — Opt out of all messages. Confirmation sent immediately. No further messages.</p>
              <p><strong>UNSTOP / START</strong> — Re-subscribe to messages.</p>
              <p><strong>HELP</strong> — Receive contact information and support details.</p>
            </div>
          </section>

          {/* 5. How We Share Information */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              5. How We Share Information
            </h2>
            <p className="mb-4">
              We do not sell, rent, or trade personal information. We may share information only in
              the following limited circumstances:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-3">
              <li>
                <strong>With the school:</strong> School administrators have access to the contact
                data and messaging analytics for their own school community.
              </li>
              <li>
                <strong>With service providers:</strong> We work with vetted third-party providers
                to deliver messaging services (including SMS carriers), host our infrastructure,
                and process payments. These providers are contractually prohibited from using your
                data for any purpose other than providing services to us.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose information if required by law,
                court order, or governmental authority, or to protect the rights and safety of
                Kesher, our users, or the public.
              </li>
              <li>
                <strong>Business transfers:</strong> In the event of a merger, acquisition, or sale
                of assets, contact information may be transferred. We will notify affected parties
                in advance.
              </li>
            </ul>
            <p className="mt-4 font-medium text-zinc-700">
              As stated in Section 4, mobile phone numbers and SMS opt-in data are explicitly
              excluded from any third-party sharing for marketing or promotional purposes.
            </p>
          </section>

          {/* 6. FERPA */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              6. Student Data and FERPA
            </h2>
            <p>
              To the extent Kesher processes education records as defined under the Family
              Educational Rights and Privacy Act (FERPA), we do so solely as a service provider
              to the school and only at the school's direction. Schools retain control over their
              students' education records. Kesher does not use student data for any purpose
              other than providing the services requested by the school, and does not disclose
              student data to third parties except as directed by the school or as required by law.
            </p>
          </section>

          {/* 7. Data Security */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              7. Data Security
            </h2>
            <p>
              We implement industry-standard security measures including encryption in transit
              and at rest, access controls, and regular security reviews. However, no method
              of transmission over the internet or electronic storage is 100% secure. We encourage
              School Users to protect their login credentials and notify us immediately of any
              suspected unauthorized access.
            </p>
          </section>

          {/* 8. Data Retention */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              8. Data Retention
            </h2>
            <p>
              We retain contact and messaging data for as long as a school maintains an active
              account with Kesher. SMS opt-out records (suppression lists) are retained
              indefinitely to ensure we do not re-contact opted-out individuals. Upon account
              termination, schools may request deletion of their data in accordance with our
              data retention policy. Certain data may be retained longer if required by law.
            </p>
          </section>

          {/* 9. Your Rights */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              9. Your Rights
            </h2>
            <p className="mb-4">
              Depending on your location, you may have rights to:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal retention requirements)</li>
              <li>Opt out of SMS communications at any time by replying STOP</li>
              <li>Contact your school directly to update or remove your contact information</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>.
              For information stored by your school, please contact the school directly.
            </p>
          </section>

          {/* 10. Children */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              10. Children&apos;s Privacy
            </h2>
            <p>
              Kesher is a platform used by schools to communicate with their communities.
              When schools send communications to students who are minors, the school is
              responsible for ensuring that appropriate parental or guardian consent has been
              obtained. We do not knowingly collect personal information directly from children
              under the age of 13 without parental consent.
            </p>
          </section>

          {/* 11. Changes */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify School Users
              of material changes by email or by posting a notice on the platform. The effective
              date at the top of this page indicates when the policy was last updated. Your
              continued use of Kesher after changes are posted constitutes your acceptance of
              the updated policy.
            </p>
          </section>

          {/* 12. Contact */}
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              12. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your information,
              please contact us:
            </p>
            <address className="not-italic mt-4 space-y-1.5">
              <p><strong>{COMPANY_NAME}</strong></p>
              <p>Operated by La Voral LLC</p>
              <p>
                Email:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>
              </p>
              <p>
                Website:{" "}
                <a href={WEBSITE} className="underline underline-offset-2">{WEBSITE}</a>
              </p>
            </address>
            <p className="mt-4">
              For SMS opt-out, reply <strong>STOP</strong> to any message, or email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a>{" "}
              with your phone number and the school name.
            </p>
          </section>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
