import type { Metadata } from "next";
import { PublicHeader } from "@/app/components/PublicHeader";
import { PublicFooter } from "@/app/components/PublicFooter";

export const metadata: Metadata = {
  title: "Contact — Kesher",
  description: "Contact Kesher for general support and privacy questions.",
};

const CONTACT_EMAIL = "contact@kesherhq.co";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-[860px] mx-auto w-full px-6 py-16">

        {/* Page title */}
        <div className="mb-12">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f] shrink-0">
              <span className="text-[11px] font-bold text-white tracking-tight select-none">K</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900 leading-tight">Kesher</p>
              <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
                The modern communications platform for schools.
              </p>
            </div>
          </div>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight mb-2">Contact</h1>
          <p className="text-lg text-zinc-400">Need help? We&apos;re here.</p>
        </div>

        {/* Contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-4">
              General Support
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[15px] font-medium text-zinc-900 hover:text-blue-600 transition-colors duration-150 block"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              Questions about the platform, your account, or sending messages.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-4">
              Privacy Questions
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[15px] font-medium text-zinc-900 hover:text-blue-600 transition-colors duration-150 block"
            >
              {CONTACT_EMAIL}
            </a>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              Data requests, opt-out assistance, and privacy policy inquiries.
            </p>
          </div>

        </div>

        {/* Response time */}
        <div className="flex items-center gap-3 pb-12 mb-12 border-b border-zinc-100">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <p className="text-sm text-zinc-500">
            Average response time:{" "}
            <span className="font-medium text-zinc-700">within 1 business day</span>
          </p>
        </div>

        {/* About Kesher */}
        <p className="text-sm text-zinc-400 leading-relaxed max-w-[520px]">
          Kesher is a modern communications platform built for schools to communicate
          with parents, students, alumni, faculty, and staff through Email, SMS, and WhatsApp.
        </p>

      </main>

      <PublicFooter />
    </div>
  );
}
