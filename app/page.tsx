import type { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  Smartphone,
  MessageSquare,
  Users,
  Send,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileText,
  ChevronRight,
  Layers,
  Eye,
} from "lucide-react";
import { LandingHeader } from "./components/landing/LandingHeader";
import { HeroDashboard } from "./components/landing/HeroDashboard";
import { AudienceScreen } from "./components/landing/AudienceScreen";
import { ChannelComposer } from "./components/landing/ChannelComposer";
import { AnalyticsSection } from "./components/landing/AnalyticsSection";
import { FinalCTA } from "./components/landing/FinalCTA";
import { LandingFooter } from "./components/landing/LandingFooter";
import { Reveal } from "./components/landing/Reveal";
import { HeroContent } from "./components/landing/HeroContent";

export const metadata: Metadata = {
  title: "Kesher — School Communications Platform",
  description:
    "Kesher is a purpose-built communications platform for schools. Send SMS, email, and WhatsApp messages to parents, students, and staff from one place.",
};

const CONTACT_EMAIL = "contact@kesherhq.co";
const DEMO_MAILTO   = `mailto:${CONTACT_EMAIL}?subject=Demo%20Request%20%E2%80%94%20Kesher`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const CHANNELS = [
  { Icon: Smartphone,    label: "SMS",      color: "text-accent",      bg: "bg-accent-tint",  border: "border-accent-border" },
  { Icon: Mail,          label: "Email",    color: "text-zinc-600",    bg: "bg-zinc-50",      border: "border-zinc-200"      },
  { Icon: MessageSquare, label: "WhatsApp", color: "text-accent",      bg: "bg-accent-tint",  border: "border-accent-border" },
];

const PROOF_ITEMS = [
  { Icon: Layers,   text: "Audiences" },
  { Icon: Send,     text: "Email, SMS & WhatsApp" },
  { Icon: Eye,      text: "Delivery visibility" },
];

const FEATURES = [
  {
    Icon: Users,
    title: "One contact directory",
    body: "Import your school's contact list and organize it by role — parents, students, staff, alumni, board members, and donors. Every contact in one place, always up to date.",
  },
  {
    Icon: Send,
    title: "Simple message campaigns",
    body: "Write a message, choose your audience, pick a channel, and send. Track delivery, opens, and failures in real time. Every campaign is saved with its full history.",
  },
  {
    Icon: Layers,
    title: "Audiences and groups",
    body: "Create custom audience segments — grade level, homeroom, specific families. Message exactly who needs to hear from you, without copy-pasting lists.",
  },
];

const COMPLIANCE_ITEMS = [
  {
    Icon: ShieldCheck,
    title: "A2P 10DLC Registered",
    body: "Kesher operates as a registered A2P 10DLC messaging platform for school communications. All SMS is sent from a dedicated campaign registered with The Campaign Registry (TCR).",
  },
  {
    Icon: CheckCircle2,
    title: "CTIA-Compliant",
    body: "Every outbound SMS message includes compliant STOP and HELP instructions. Opt-out requests are processed immediately and suppress that number from all future sends — permanently.",
  },
  {
    Icon: FileText,
    title: "School-Facilitated Opt-In",
    body: "Schools certify at import that every contact has provided explicit written or digital consent. Kesher enforces this certification before any phone number can be imported.",
  },
  {
    Icon: ShieldCheck,
    title: "No Third-Party Data Sharing",
    body: "Mobile information is never shared with third parties or affiliates for marketing or promotional purposes. Text messaging opt-in data and consent records are not shared with anyone.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="kesher-landing min-h-screen bg-background flex flex-col">
      <LandingHeader demoMailto={DEMO_MAILTO} />
      <main className="flex-1">
        <HeroSection />
        <ProofStrip />

        <section id="product" className="py-20 sm:py-28 px-4 sm:px-6 bg-surface-sage border-y border-surface-sage-border">
          <div className="max-w-6xl mx-auto">
            <AudienceScreen />
          </div>
        </section>

        <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <SectionIntro
                eyebrow="Compose"
                title="Write it once. Send it where it matters."
                body="Switch channels without losing the thread. Every send is consent-aware, personalized, and trackable."
              />
            </Reveal>
            <Reveal delay={80}>
              <ChannelComposer />
            </Reveal>
          </div>
        </section>

        <section className="py-20 sm:py-28 px-4 sm:px-6 bg-surface-2 border-y border-border-subtle">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <SectionIntro eyebrow="Analytics" title="See what landed." body="Every send is tracked — delivery, opens, and failures — down to the individual recipient." />
            </Reveal>
            <Reveal delay={80}>
              <AnalyticsSection />
            </Reveal>
          </div>
        </section>

        <FinalCTA demoMailto={DEMO_MAILTO} />

        <FeaturesSection />
        <ComplianceSection />
        <ForReviewersSection />
        <ContactSection />
      </main>
      <LandingFooter contactEmail={CONTACT_EMAIL} demoMailto={DEMO_MAILTO} />
    </div>
  );
}

// ─── Section intro helper ─────────────────────────────────────────────────────

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-xl mb-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">{eyebrow}</p>
      <h2 className="text-4xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.1]">{title}</h2>
      <p className="text-[16px] text-text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 sm:pt-28 pb-16 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-3xl mx-auto text-center">
          <HeroContent demoMailto={DEMO_MAILTO} />
        </div>

        {/* Product UI — faithful replica of the actual Kesher dashboard, no browser chrome */}
        <div className="mt-16 sm:mt-20">
          <HeroDashboard />
        </div>
      </div>
    </section>
  );
}

// ─── Proof strip ──────────────────────────────────────────────────────────────

function ProofStrip() {
  return (
    <section className="border-y border-border-subtle bg-surface-2 py-5 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {PROOF_ITEMS.map(({ Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-[13px] text-text-secondary">
              <Icon size={14} className="text-accent shrink-0" strokeWidth={2} />
              {text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features (compact detail rows) ────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <SectionIntro
            eyebrow="Platform"
            title="Everything your school needs to stay connected"
            body="Kesher replaces the patchwork of email blasts, group texts, and manual lists that most schools rely on. One platform, every channel, for every part of your community."
          />
        </Reveal>

        {/* Compact numbered rows */}
        <div className="border-t border-border-subtle mb-6">
          {FEATURES.map(({ Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 60}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-8 py-7 border-b border-border-subtle">
                <span className="shrink-0 text-[11px] font-mono font-semibold text-text-muted tracking-widest sm:w-8 sm:pt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon size={16} className="text-accent" strokeWidth={1.75} />
                      <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
                    </div>
                    <p className="text-[14px] text-text-secondary leading-relaxed max-w-xl">{body}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Channel breakdown */}
        <Reveal>
          <div className="rounded-xl border border-border bg-surface-2 p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-5">Supported Channels</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {CHANNELS.map(({ Icon, label, color, bg, border }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${bg} ${border}`}>
                    <Icon size={15} className={color} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-text-primary">{label}</p>
                    <p className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">
                      {label === "SMS"
                        ? "Text messages sent via a 10DLC-registered long code. Opt-outs handled in real time."
                        : label === "Email"
                        ? "HTML and plain-text email with delivery confirmation and open rate tracking."
                        : "WhatsApp Business messaging for school communities that prefer it."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Compliance / Security ──────────────────────────────────────────────────────

function ComplianceSection() {
  return (
    <section id="security" className="py-20 sm:py-24 px-4 sm:px-6 bg-surface-2 border-y border-border-subtle">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="max-w-2xl mb-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-3">Security &amp; Compliance</p>
            <h2 className="text-4xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.1]">
              Meets carrier and regulatory standards
            </h2>
            <p className="text-[16px] text-text-secondary leading-relaxed">
              Every SMS message sent through Kesher complies with CTIA Messaging Principles and Best Practices,
              TCPA requirements, and 10DLC registration guidelines. Kesher acts as a messaging service provider;
              each school is the Message Originator and is responsible for obtaining and maintaining consent records.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {COMPLIANCE_ITEMS.map(({ Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 60}>
              <div className="rounded-xl border border-border bg-surface p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-tint border border-accent-border">
                    <Icon size={16} className="text-accent" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-text-primary mb-1.5">{title}</h3>
                    <p className="text-[13px] text-text-secondary leading-relaxed">{body}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Doc links */}
        <Reveal>
          <div className="rounded-xl border border-border bg-surface px-6 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted mb-4">Compliance Documentation</p>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "SMS Terms & Conditions",    href: "/sms-terms"    },
                { label: "Privacy Policy",             href: "/privacy"      },
                { label: "Call-to-Action (CTA) Docs", href: "/cta"          },
                { label: "Sample Opt-In Form",         href: "/sample-form"  },
                { label: "Terms of Service",           href: "/terms"        },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 min-h-[44px] rounded-md border border-border bg-surface-2 px-3.5 text-[12px] font-medium text-text-primary hover:border-accent-border transition-colors"
                >
                  <FileText size={12} strokeWidth={1.75} className="text-text-muted" />
                  {label}
                  <ChevronRight size={11} strokeWidth={2} className="text-text-muted" />
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── For Reviewers ────────────────────────────────────────────────────────────

function ForReviewersSection() {
  return (
    <section className="py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="rounded-xl border border-border bg-surface p-7 sm:p-9">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-4">
                For Carrier &amp; Compliance Reviewers
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary mb-3">
                Platform overview — Sinch, TCR, and carrier review
              </h2>
              <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
                Kesher operates as an A2P messaging platform exclusively for educational institutions. Schools use Kesher
                to send transactional and informational communications — announcements, emergency alerts, attendance
                notices, event reminders — to community members who have provided explicit opt-in consent.
              </p>
              <div className="grid grid-cols-1 gap-2 mb-5">
                {[
                  { label: "Program type",    value: "School communications — informational and transactional only. No marketing." },
                  { label: "Opt-in method",   value: "School-facilitated explicit opt-in via enrollment forms, parent portals, and staff onboarding" },
                  { label: "Message content", value: "Announcements, emergency alerts, event reminders, attendance, schedule changes" },
                  { label: "Opt-out",         value: "STOP keyword — processed in real time, suppressed permanently" },
                  { label: "Help response",   value: "HELP keyword triggers automated message with support contact" },
                  { label: "Contact",         value: CONTACT_EMAIL },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4 py-2 border-b border-border-subtle last:border-0">
                    <span className="w-32 shrink-0 text-[12px] font-semibold text-text-secondary">{label}</span>
                    <span className="text-[12px] text-text-primary leading-relaxed">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[
                  { label: "Sample Opt-In Form",     href: "/sample-form" },
                  { label: "CTA Documentation",      href: "/cta"         },
                  { label: "SMS Terms & Conditions", href: "/sms-terms"   },
                  { label: "Privacy Policy",         href: "/privacy"     },
                ].map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    className="inline-flex items-center gap-1.5 min-h-[36px] rounded-md border border-border bg-surface-2 px-3 text-[12px] font-medium text-text-primary hover:bg-surface transition-colors"
                  >
                    <FileText size={12} strokeWidth={1.75} className="text-text-muted" />
                    {label}
                  </Link>
                ))}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-1.5 min-h-[36px] rounded-md border border-border bg-surface-2 px-3 text-[12px] font-medium text-text-primary hover:bg-surface transition-colors"
                >
                  <Mail size={12} strokeWidth={1.75} className="text-text-muted" />
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function ContactSection() {
  return (
    <section id="contact" className="py-20 sm:py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-4">Contact</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.2]">
              Get in touch
            </h2>
            <p className="text-[15px] text-text-secondary leading-relaxed mb-8">
              We work with schools directly. Whether you want to see a demo, have questions about how Kesher
              works, or want to get your school set up — reach out and we&apos;ll respond promptly.
            </p>
            <div className="space-y-4">
              <a
                href={DEMO_MAILTO}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 hover:border-accent-border hover:shadow-sm transition-all duration-150 group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-surface-2 flex items-center justify-center">
                  <Send size={16} className="text-text-secondary" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary">Book a Demo</p>
                  <p className="text-[12px] text-text-secondary">{CONTACT_EMAIL}</p>
                </div>
                <ArrowRight size={14} className="text-text-muted group-hover:text-text-secondary shrink-0 transition-colors" strokeWidth={2} />
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 hover:border-accent-border hover:shadow-sm transition-all duration-150 group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-surface-2 flex items-center justify-center">
                  <Mail size={16} className="text-text-secondary" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary">Questions &amp; Support</p>
                  <p className="text-[12px] text-text-secondary">{CONTACT_EMAIL}</p>
                </div>
                <ArrowRight size={14} className="text-text-muted group-hover:text-text-secondary shrink-0 transition-colors" strokeWidth={2} />
              </a>
            </div>
          </Reveal>

          {/* Right — FAQ-style trust signals */}
          <Reveal delay={80}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted mb-5">Common Questions</p>
            <div className="space-y-5">
              {[
                {
                  q: "Is Kesher available to any school?",
                  a: "Yes. Kesher is built for K–12 schools, yeshivas, community schools, and educational organizations of any size. We work with schools directly to get them onboarded.",
                },
                {
                  q: "How does consent work for SMS?",
                  a: "Every school must certify at import that each contact has provided explicit written or digital consent to receive SMS messages. Kesher enforces this before any number can be imported.",
                },
                {
                  q: "What happens when someone replies STOP?",
                  a: "Opt-out requests are processed in real time. The number is permanently suppressed from all future sends for that school and a confirmation message is sent automatically.",
                },
                {
                  q: "Is there a contract or long-term commitment?",
                  a: "Reach out to discuss your school's needs. We work with schools directly to find the right setup.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="border-b border-border-subtle pb-5 last:border-0 last:pb-0">
                  <p className="text-[14px] font-semibold text-text-primary mb-1.5">{q}</p>
                  <p className="text-[13px] text-text-secondary leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

