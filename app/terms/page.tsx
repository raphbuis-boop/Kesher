import type { Metadata } from "next";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";
import { LegalPageHeader } from "@/app/components/LegalPageHeader";

export const metadata: Metadata = {
  title: "Terms of Service — Kesher",
  description: "Terms of Service for Kesher School Communications Platform",
};

const EFFECTIVE_DATE = "July 6, 2026";
const SUPPORT_EMAIL  = "help@kesherhq.co";
const COMPANY_NAME   = "Kesher";
const WEBSITE        = "https://www.kesherhq.co";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-[860px] mx-auto w-full px-6 py-14">

        <LegalPageHeader
          title="Terms of Service"
          effectiveDate={EFFECTIVE_DATE}
          lastUpdated={EFFECTIVE_DATE}
        />

        <div className="text-[14px] text-zinc-600 space-y-12 leading-relaxed">

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Kesher platform ("Service") operated by {COMPANY_NAME}
              ("we", "us", or "our"), you agree to be bound by these Terms of Service ("Terms").
              If you are using Kesher on behalf of a school or organization, you represent
              that you have authority to bind that organization to these Terms.
            </p>
            <p className="mt-4">
              If you do not agree to these Terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              2. Description of Service
            </h2>
            <p>
              Kesher is a school communications platform that enables educational institutions
              to manage their community directories and send communications — including email,
              SMS, and WhatsApp messages — to parents, guardians, students, staff, alumni,
              and other authorized school community members.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              3. Account Registration
            </h2>
            <p>
              Access to the Kesher platform requires registration and approval. School
              administrators are responsible for maintaining the security of their login
              credentials and for all activity that occurs under their account. You must
              notify us immediately at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">{SUPPORT_EMAIL}</a>{" "}
              of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              4. Acceptable Use
            </h2>
            <p className="mb-4">
              You agree to use Kesher only for lawful school communications purposes. You
              may not use the Service to:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2.5">
              <li>Send unsolicited bulk messages (spam)</li>
              <li>Send messages to individuals who have opted out or requested not to be contacted</li>
              <li>Transmit content that is abusive, threatening, harassing, or unlawful</li>
              <li>Violate any applicable law or regulation, including TCPA, CAN-SPAM, or CTIA guidelines</li>
              <li>Impersonate any person or organization</li>
              <li>Collect or harvest contact information for any purpose other than school communications</li>
              <li>Resell, sublicense, or otherwise commercialize access to the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              5. SMS Messaging
            </h2>
            <p>
              Schools are solely responsible for ensuring that recipients have consented to
              receive SMS messages before importing phone numbers into Kesher. By sending SMS
              through the Service, you represent and warrant that:
            </p>
            <ul className="list-disc list-outside ml-4 space-y-2.5 mt-4">
              <li>You have obtained appropriate consent from all SMS recipients</li>
              <li>You will honor all opt-out requests immediately</li>
              <li>Your messages comply with TCPA, CTIA Messaging Principles, and all applicable carrier requirements</li>
              <li>You will maintain accurate consent records as required by law</li>
            </ul>
            <p className="mt-4">
              Please review our{" "}
              <a href="/sms-terms" className="underline underline-offset-2">SMS Terms</a>{" "}
              for full details on our SMS messaging program and opt-out procedures.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              6. Data and Privacy
            </h2>
            <p>
              Your use of Kesher is subject to our{" "}
              <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>, which is
              incorporated into these Terms by reference. You retain ownership of all contact
              data you upload to Kesher. By uploading data, you grant us the limited right to
              process that data solely for the purpose of providing the Service.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              7. Intellectual Property
            </h2>
            <p>
              The Kesher platform, including its design, software, and content, is owned by
              {" "}{COMPANY_NAME} and protected by intellectual property laws. You may not
              copy, modify, distribute, or reverse engineer any part of the Service without
              our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              8. Service Availability
            </h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access
              to the Service. We may perform maintenance, updates, or modifications that
              temporarily affect availability. We will provide reasonable notice of planned
              downtime where possible.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              9. Disclaimers
            </h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
              IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, {COMPANY_NAME.toUpperCase()}{" "}
              DISCLAIMS ALL WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="mt-4">
              We are not responsible for the content of messages sent by schools through the
              platform, or for the accuracy of contact information uploaded by schools.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              10. Limitation of Liability
            </h2>
            <p>
              TO THE FULLEST EXTENT PERMITTED BY LAW, {COMPANY_NAME.toUpperCase()} SHALL NOT
              BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
              DAMAGES ARISING FROM YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF
              THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT
              PAID BY YOU FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              11. Termination
            </h2>
            <p>
              We may suspend or terminate your access to the Service at any time for violation
              of these Terms, non-payment, or any other reason with reasonable notice. You may
              request account deletion by contacting us. Upon termination, you may request an
              export of your data within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              12. Modifications
            </h2>
            <p>
              We may update these Terms from time to time. Material changes will be communicated
              by email to registered administrators or by notice on the platform. Your continued
              use of the Service after changes take effect constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              13. Governing Law
            </h2>
            <p>
              These Terms are governed by the laws of the State of New Jersey, United States,
              without regard to conflict of law principles. Any disputes arising under these
              Terms shall be resolved through binding arbitration or in the courts of New Jersey,
              as applicable.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900 mb-4 tracking-tight">
              14. Contact
            </h2>
            <p>Questions about these Terms? Contact us:</p>
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
