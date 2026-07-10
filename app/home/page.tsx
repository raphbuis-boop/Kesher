import type { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  Smartphone,
  MessageSquare,
  Users,
  Send,
  Upload,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileText,
  AlertCircle,
  ChevronRight,
  LayoutDashboard,
  Layers,
  Activity,
  Settings,
  PenLine,
  UserPlus,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Kesher — School Communications Platform",
  description:
    "Kesher is a purpose-built communications platform for schools. Send SMS, email, and WhatsApp messages to parents, students, and staff from one place.",
};

const CONTACT_EMAIL = "contact@kesherhq.co";
const DEMO_MAILTO   = `mailto:${CONTACT_EMAIL}?subject=Demo%20Request%20%E2%80%94%20Kesher`;

// ─── Data ─────────────────────────────────────────────────────────────────────

const CHANNELS = [
  { Icon: Smartphone,    label: "SMS",      color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200"    },
  { Icon: Mail,          label: "Email",    color: "text-zinc-600",    bg: "bg-zinc-50",    border: "border-zinc-200"    },
  { Icon: MessageSquare, label: "WhatsApp", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
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

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Import your contact list",
    body: "Upload a CSV of your school community. Before any number is saved, you certify that every person has opted in to receive messages from your school. Kesher enforces this at every import.",
  },
  {
    step: "02",
    title: "Compose your message",
    body: "Write your message, select an audience — Parents, Staff, All Families — and choose the channel. Preview before sending. Every send requires a deliberate confirmation.",
  },
  {
    step: "03",
    title: "Send and track delivery",
    body: "Kesher delivers your message and tracks every result: delivered, opened, failed, or opted out. Unsubscribes are processed automatically and are permanent.",
  },
];

const SAMPLE_MESSAGES = [
  {
    label: "Event Reminder",
    channel: "SMS",
    text: "[School Name]: Parent-Teacher conferences are tomorrow, Thu 3/20, 4–8 PM. Sign up at school.edu/conferences. Reply STOP to opt out.",
  },
  {
    label: "Emergency Alert",
    channel: "SMS",
    text: "[School Name] ALERT: School will be closed tomorrow, Fri 1/17, due to inclement weather. All after-school programs are also cancelled. Reply STOP to opt out.",
  },
  {
    label: "General Announcement",
    channel: "SMS",
    text: "[School Name]: Registration for the 2025–26 school year opens next Monday. Visit school.edu/register or call 555-000-0000. Reply STOP to opt out.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingNav />
      <main className="flex-1">
        <HeroSection />
        <PositioningBar />
        <FeaturesSection />
        <HowItWorksSection />
        <AboutSection />
        <MessageExamplesSection />
        <ComplianceSection />
        <ForReviewersSection />
        <ContactSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

        {/* Wordmark */}
        <Link href="/home" className="flex items-center gap-2.5 group shrink-0" aria-label="Kesher home">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f] group-hover:bg-zinc-700 transition-colors">
            <span className="text-[11px] font-bold text-white tracking-tight select-none">K</span>
          </div>
          <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight">Kesher</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-5 flex-1" aria-label="Main navigation">
          <a href="#features"     className="text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors">Features</a>
          <a href="#how-it-works" className="text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors">How it works</a>
          <a href="#compliance"   className="text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors">Compliance</a>
          <a href="#contact"      className="text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors">Contact</a>
        </nav>

        {/* CTA */}
        <a
          href={DEMO_MAILTO}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Request a demo
          <ArrowRight size={13} strokeWidth={2} />
        </a>

      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="pt-20 pb-16 px-6">
      <div className="max-w-3xl mx-auto text-center">

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 mb-7">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-medium text-zinc-600 tracking-wide">Purpose-built for schools</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-[62px] font-semibold tracking-[-0.03em] leading-[1.07] text-[#0f0f0f] mb-5">
          Reach every parent.<br />
          Every student.<br className="hidden sm:block" />
          Every time.
        </h1>

        {/* Sub-headline */}
        <p className="text-[18px] text-zinc-500 leading-relaxed max-w-xl mx-auto mb-8">
          Kesher gives school administrators one place to communicate with their entire community —
          via SMS, email, and WhatsApp — without managing multiple tools or worrying about compliance.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={DEMO_MAILTO}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0f0f0f] px-5 py-2.5 text-[14px] font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Request a demo
            <ArrowRight size={14} strokeWidth={2} />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
          >
            See how it works
          </a>
        </div>

        {/* Channel badges */}
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          {CHANNELS.map(({ Icon, label, color, bg, border }) => (
            <span
              key={label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium ${bg} ${border} ${color}`}
            >
              <Icon size={13} strokeWidth={1.75} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Product UI — faithful replica of the actual Kesher dashboard */}
      <div className="mt-14 max-w-5xl mx-auto">
        <div className="rounded-xl border border-zinc-200 overflow-hidden shadow-[0_8px_48px_rgba(0,0,0,0.10)]">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-200 bg-[#f5f5f5]">
            <div className="h-2.5 w-2.5 rounded-full bg-[#e7e7e7]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#e7e7e7]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#e7e7e7]" />
            <div className="ml-4 flex items-center gap-2 flex-1 max-w-xs rounded-md bg-white border border-zinc-200 px-3 h-6">
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
              <span className="text-[10px] text-zinc-400">kesherhq.co/dashboard</span>
            </div>
          </div>
          <AppDashboardPreview />
        </div>
      </div>
    </section>
  );
}

// ─── App Dashboard Preview ────────────────────────────────────────────────────
// Pixel-faithful HTML render of the actual Kesher dashboard.
// Colors, spacing, and component structure match the production app exactly.

function AppDashboardPreview() {
  const sidebarItems = [
    { label: "Overview",  Icon: LayoutDashboard, active: true  },
    { label: "People",    Icon: Users,            active: false },
    { label: "Audiences", Icon: Layers,           active: false },
    { label: "Messages",  Icon: MessageSquare,    active: false },
    { label: "Activity",  Icon: Activity,         active: false },
    { label: "Imports",   Icon: Upload,           active: false },
  ];

  const feedItems = [
    { subject: "Shabbat schedule reminder",     channel: "sms",   audience: "Parents",   recipients: 186, status: "sent", time: "2h ago"  },
    { subject: "Spring Gala — save the date",   channel: "email", audience: "Families",  recipients: 312, status: "sent", time: "1d ago"  },
    { subject: "School closure — weather alert",channel: "sms",   audience: "All",       recipients: 498, status: "sent", time: "3d ago"  },
  ];

  const channelColor: Record<string, { bg: string; text: string; label: string }> = {
    sms:   { bg: "bg-blue-50",    text: "text-blue-500",    label: "SMS"   },
    email: { bg: "bg-zinc-100",   text: "text-zinc-500",    label: "Email" },
  };

  return (
    <div className="flex bg-[#fafafa]" style={{ minHeight: 400 }}>

      {/* ── Sidebar ── */}
      <div className="w-[210px] shrink-0 border-r border-[#e7e7e7] bg-[#f5f5f5] flex flex-col hidden sm:flex">
        {/* Wordmark */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-[6px] bg-[#0f0f0f] flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-white">K</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#0f0f0f] leading-none">Kesher</p>
              <p className="text-[9px] text-[#a1a1aa] leading-none mt-0.5">School Comms</p>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="px-4 pb-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#c4c4c8]">Navigation</p>
        </div>

        {/* Nav items */}
        <div className="flex-1 px-2 space-y-0.5">
          {sidebarItems.map(({ label, Icon, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium ${
                active
                  ? "bg-[#eff6ff] text-[#2563eb]"
                  : "text-[#71717a]"
              }`}
            >
              <Icon
                size={12}
                strokeWidth={active ? 2 : 1.75}
                className={active ? "text-[#2563eb]" : "text-[#a1a1aa]"}
              />
              {label}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="px-2 py-2 border-t border-[#ebebeb]">
          <div className="flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium text-[#a1a1aa]">
            <Settings size={12} strokeWidth={1.75} className="text-[#c4c4c8]" />
            Settings
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Page header */}
        <div className="sticky top-0 border-b border-[#e7e7e7] bg-white/95 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-[#0f0f0f]">Overview</p>
            <p className="text-[9px] text-[#a1a1aa] mt-px">Heichal HaTorah</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-2.5 py-1">
            <PenLine size={10} strokeWidth={2} className="text-white" />
            <span className="text-[10px] font-medium text-white">Compose</span>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { label: "Active Contacts", value: "412",   sub: "in directory"      },
              { label: "This Week",       value: "3",     sub: "campaigns sent"     },
              { label: "Delivery Rate",   value: "97.6%", sub: "last 30 days",  accent: "border-t-2 border-t-emerald-500" },
              { label: "Open Rate",       value: "64.2%", sub: "email, last 30d", accent: "border-t-2 border-t-sky-500"  },
            ].map(({ label, value, sub, accent }) => (
              <div
                key={label}
                className={`rounded-xl border border-[#e7e7e7] bg-white px-3.5 py-3 ${accent ?? ""}`}
              >
                <p className="text-[8px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{label}</p>
                <p className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums leading-none text-[#0f0f0f]">{value}</p>
                <p className="mt-1.5 text-[9px] text-[#a1a1aa]">{sub}</p>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f0f0]">
              <div>
                <p className="text-[11px] font-semibold text-[#0f0f0f]">Activity</p>
                <p className="text-[9px] text-[#a1a1aa] mt-px">Campaigns and imports</p>
              </div>
              <span className="text-[9px] font-medium text-[#a1a1aa]">View all →</span>
            </div>
            {feedItems.map((item, i) => {
              const ch = channelColor[item.channel] ?? channelColor.sms;
              const isLast = i === feedItems.length - 1;
              return (
                <div key={item.subject} className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}>
                  <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={10} className="text-emerald-500" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-[11px] font-medium text-[#0f0f0f] truncate">{item.subject}</p>
                      <span className={`shrink-0 rounded-full px-1.5 py-px text-[8px] font-semibold ${ch.bg} ${ch.text}`}>
                        {ch.label}
                      </span>
                    </div>
                    <p className="text-[9px] text-[#a1a1aa] mt-px">
                      {item.audience} · {item.recipients} recipients · {item.status}
                    </p>
                  </div>
                  <span className="text-[9px] tabular-nums text-[#a1a1aa] shrink-0">{item.time}</span>
                </div>
              );
            })}
          </div>

          {/* Quick actions row */}
          <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f0f0f0]">
              <p className="text-[11px] font-semibold text-[#0f0f0f]">Quick Actions</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#f5f5f5]">
              {[
                { Icon: PenLine,  label: "Compose",         sub: "Send to any audience" },
                { Icon: Upload,   label: "Import Contacts", sub: "Upload a CSV"         },
                { Icon: UserPlus, label: "Add Contact",     sub: "Add a single person"  },
                { Icon: Layers,   label: "Audiences",       sub: "Manage groups"        },
              ].map(({ Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2.5 px-4 py-3">
                  <div className="h-7 w-7 shrink-0 rounded-lg border border-[#e7e7e7] bg-white flex items-center justify-center">
                    <Icon size={11} className="text-[#71717a]" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-[#0f0f0f]">{label}</p>
                    <p className="text-[9px] text-[#a1a1aa]">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Positioning Bar ──────────────────────────────────────────────────────────

function PositioningBar() {
  return (
    <section className="border-y border-zinc-100 bg-zinc-50 py-5 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {[
            { text: "Built specifically for K–12 schools and educational organizations" },
            { text: "Not adapted from a general-purpose marketing tool" },
            { text: "Compliance built in — not bolted on" },
          ].map(({ text }) => (
            <div key={text} className="flex items-center gap-2 text-[13px] text-zinc-600">
              <CheckCircle2 size={14} className="text-zinc-400 shrink-0" strokeWidth={2} />
              {text}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">

        <div className="max-w-xl mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">Platform</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-[#0f0f0f] mb-4 leading-[1.1]">
            Everything your school needs to stay connected
          </h2>
          <p className="text-[16px] text-zinc-500 leading-relaxed">
            Kesher replaces the patchwork of email blasts, group texts, and manual lists that most schools
            rely on. One platform, every channel, for every part of your community.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 mb-6">
          {FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 mb-4">
                <Icon size={16} className="text-zinc-600" strokeWidth={1.75} />
              </div>
              <h3 className="text-[15px] font-semibold text-[#0f0f0f] mb-2">{title}</h3>
              <p className="text-[14px] text-zinc-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Channel breakdown */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400 mb-5">Supported Channels</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {CHANNELS.map(({ Icon, label, color, bg, border }) => (
              <div key={label} className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${bg} ${border}`}>
                  <Icon size={15} className={color} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0f0f0f]">{label}</p>
                  <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">
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
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-6 bg-zinc-50 border-y border-zinc-100">
      <div className="max-w-6xl mx-auto">

        <div className="max-w-xl mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">How It Works</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-[#0f0f0f] mb-4 leading-[1.1]">
            From contact list to delivered message in minutes
          </h2>
          <p className="text-[16px] text-zinc-500 leading-relaxed">
            Kesher is designed for school administrators, not developers. No setup complexity, no integrations to configure.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-10">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <div key={step} className="flex flex-col gap-4">
              <div className="text-[11px] font-semibold font-mono text-zinc-300 tracking-widest">{step}</div>
              <div className="h-px bg-zinc-300 w-full" />
              <h3 className="text-[15px] font-semibold text-[#0f0f0f]">{title}</h3>
              <p className="text-[14px] text-zinc-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Consent enforcement callout */}
        <div className="mt-12 rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 flex gap-4">
          <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="text-[13px] font-semibold text-amber-900 mb-1">Consent certification is required before any import</p>
            <p className="text-[13px] text-amber-700 leading-relaxed">
              Before any phone numbers enter Kesher, the school administrator must certify that every person on the list
              has provided explicit written or digital consent to receive SMS messages. This is enforced at every import — not optional.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <section id="about" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-16 items-start">

          {/* Left — story */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-4">About Kesher</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-[#0f0f0f] mb-5 leading-[1.2]">
              Built because schools deserve better than group texts and mass emails
            </h2>
            <div className="space-y-4 text-[15px] text-zinc-500 leading-relaxed">
              <p>
                Most schools communicate through a patchwork of tools — a group text thread here, a Mailchimp blast there,
                an automated robocall for emergencies. None of them were designed with schools in mind, and none of them
                talk to each other.
              </p>
              <p>
                Kesher was built to solve exactly that. One platform that manages your school's contact directory,
                lets you compose and send messages across SMS, email, and WhatsApp, and handles all the compliance
                requirements that come with modern messaging — so your administrators don't have to.
              </p>
              <p>
                The name <em>Kesher</em> means "connection" in Hebrew. That's what we're building: genuine, reliable
                connections between schools and the families and communities they serve.
              </p>
            </div>
          </div>

          {/* Right — who it's for */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-5">Who Kesher Is For</p>
            <div className="space-y-4">
              {[
                {
                  label: "School Principals & Administrators",
                  body: "Send school-wide announcements, emergency alerts, and event reminders without needing a communications team.",
                },
                {
                  label: "Communications & Outreach Staff",
                  body: "Manage your contact directory, create audience segments, and run campaigns for specific groups — grade level, homeroom, department.",
                },
                {
                  label: "K–12 Schools and Educational Organizations",
                  body: "Day schools, yeshivas, community schools, after-school programs — any educational institution that needs to communicate reliably with its community.",
                },
              ].map(({ label, body }) => (
                <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                  <p className="text-[13px] font-semibold text-[#0f0f0f] mb-1.5">{label}</p>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── Message Examples ─────────────────────────────────────────────────────────

function MessageExamplesSection() {
  return (
    <section className="py-24 px-6 bg-zinc-50 border-y border-zinc-100">
      <div className="max-w-6xl mx-auto">

        <div className="max-w-xl mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">What Gets Sent</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-[#0f0f0f] mb-4 leading-[1.1]">
            School communications, not marketing
          </h2>
          <p className="text-[16px] text-zinc-500 leading-relaxed">
            Kesher is used exclusively for transactional and informational school communications. The platform does
            not support marketing, promotional, political, or commercial messaging of any kind.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {SAMPLE_MESSAGES.map(({ label, channel, text }) => (
            <div key={label} className="rounded-xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</p>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-500 bg-blue-50 rounded-full px-2 py-0.5">{channel}</span>
              </div>
              {/* SMS thread mockup */}
              <div className="space-y-1">
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm bg-[#0f0f0f] px-3.5 py-2.5 max-w-[95%]">
                    <p className="text-[12px] text-white leading-relaxed">{text}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 justify-end mt-1">
                  <CheckCircle2 size={9} className="text-zinc-300" strokeWidth={2} />
                  <span className="text-[9px] text-zinc-400">Delivered</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[12px] text-zinc-400 text-center">
          Representative examples only. Full message type documentation:{" "}
          <Link href="/cta" className="text-zinc-600 hover:text-zinc-900 underline underline-offset-2">CTA Documentation</Link>.
        </p>
      </div>
    </section>
  );
}

// ─── Compliance ───────────────────────────────────────────────────────────────

function ComplianceSection() {
  return (
    <section id="compliance" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">

        <div className="max-w-2xl mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-3">Compliance</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-[#0f0f0f] mb-4 leading-[1.1]">
            Meets carrier and regulatory standards
          </h2>
          <p className="text-[16px] text-zinc-500 leading-relaxed">
            Every SMS message sent through Kesher complies with CTIA Messaging Principles and Best Practices,
            TCPA requirements, and 10DLC registration guidelines. Kesher acts as a messaging service provider;
            each school is the Message Originator and is responsible for obtaining and maintaining consent records.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 mb-6">
          {COMPLIANCE_ITEMS.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-50 border border-zinc-200">
                  <Icon size={16} className="text-zinc-600" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0f0f0f] mb-1.5">{title}</h3>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Doc links */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400 mb-4">Compliance Documentation</p>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "SMS Terms & Conditions",    href: "/sms-terms"  },
              { label: "Privacy Policy",             href: "/privacy"    },
              { label: "Call-to-Action (CTA) Docs", href: "/cta"        },
              { label: "Terms of Service",           href: "/terms"      },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-[12px] font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
              >
                <FileText size={12} strokeWidth={1.75} className="text-zinc-400" />
                {label}
                <ChevronRight size={11} strokeWidth={2} className="text-zinc-300" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── For Reviewers ────────────────────────────────────────────────────────────

function ForReviewersSection() {
  return (
    <section className="py-10 px-6 bg-zinc-50 border-y border-zinc-100">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-xl border border-zinc-200 bg-white p-7 sm:p-9">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-4">
              For Carrier &amp; Compliance Reviewers
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[#0f0f0f] mb-3">
              Platform overview — Sinch, TCR, and carrier review
            </h2>
            <p className="text-[14px] text-zinc-500 leading-relaxed mb-5">
              Kesher operates as an A2P messaging platform exclusively for educational institutions. Schools use Kesher
              to send transactional and informational communications — announcements, emergency alerts, attendance
              notices, event reminders — to community members who have provided explicit opt-in consent.
            </p>
            <div className="grid gap-2 mb-5">
              {[
                { label: "Program type",    value: "School communications — informational and transactional only. No marketing." },
                { label: "Opt-in method",   value: "School-facilitated explicit opt-in via enrollment forms, parent portals, and staff onboarding" },
                { label: "Message content", value: "Announcements, emergency alerts, event reminders, attendance, schedule changes" },
                { label: "Opt-out",         value: "STOP keyword — processed in real time, suppressed permanently" },
                { label: "Help response",   value: "HELP keyword triggers automated message with support contact" },
                { label: "Contact",         value: CONTACT_EMAIL },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4 py-2 border-b border-zinc-100 last:border-0">
                  <span className="w-32 shrink-0 text-[12px] font-semibold text-zinc-500">{label}</span>
                  <span className="text-[12px] text-zinc-700 leading-relaxed">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {[
                { label: "CTA Documentation",     href: "/cta"       },
                { label: "SMS Terms & Conditions", href: "/sms-terms" },
                { label: "Privacy Policy",         href: "/privacy"   },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  <FileText size={12} strokeWidth={1.75} className="text-zinc-400" />
                  {label}
                </Link>
              ))}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                <Mail size={12} strokeWidth={1.75} className="text-zinc-400" />
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Contact ──────────────────────────────────────────────────────────────────

function ContactSection() {
  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 gap-16 items-start">

          {/* Left */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-4">Contact</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-[#0f0f0f] mb-4 leading-[1.2]">
              Get in touch
            </h2>
            <p className="text-[15px] text-zinc-500 leading-relaxed mb-8">
              We work with schools directly. Whether you want to see a demo, have questions about how Kesher
              works, or want to get your school set up — reach out and we'll respond promptly.
            </p>
            <div className="space-y-4">
              <a
                href={DEMO_MAILTO}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all duration-150 group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center">
                  <Send size={16} className="text-zinc-600" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0f0f0f]">Request a Demo</p>
                  <p className="text-[12px] text-zinc-500">{CONTACT_EMAIL}</p>
                </div>
                <ArrowRight size={14} className="text-zinc-300 group-hover:text-zinc-500 shrink-0 transition-colors" strokeWidth={2} />
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all duration-150 group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center">
                  <Mail size={16} className="text-zinc-600" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0f0f0f]">Questions &amp; Support</p>
                  <p className="text-[12px] text-zinc-500">{CONTACT_EMAIL}</p>
                </div>
                <ArrowRight size={14} className="text-zinc-300 group-hover:text-zinc-500 shrink-0 transition-colors" strokeWidth={2} />
              </a>
            </div>
          </div>

          {/* Right — FAQ-style trust signals */}
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-5">Common Questions</p>
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
              <div key={q} className="border-b border-zinc-100 pb-5 last:border-0 last:pb-0">
                <p className="text-[14px] font-semibold text-[#0f0f0f] mb-1.5">{q}</p>
                <p className="text-[13px] text-zinc-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section className="py-24 px-6 bg-[#0f0f0f]">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-white mb-5 leading-[1.1]">
          Bring your school<br className="hidden sm:block" /> community together
        </h2>
        <p className="text-[16px] text-zinc-400 leading-relaxed mb-10 max-w-lg mx-auto">
          Kesher works with schools directly. Reach out to schedule a demo or ask about getting your
          school set up — we'll get back to you promptly.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={DEMO_MAILTO}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[14px] font-medium text-[#0f0f0f] hover:bg-zinc-100 transition-colors"
          >
            Request a demo
            <ArrowRight size={14} strokeWidth={2} />
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-5 py-2.5 text-[14px] font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <Mail size={14} strokeWidth={1.75} />
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-100 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">

          <div className="flex flex-col gap-3 max-w-[220px]">
            <div className="inline-flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f]">
                <span className="text-[11px] font-bold text-white tracking-tight select-none">K</span>
              </div>
              <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight">Kesher</span>
            </div>
            <p className="text-[12px] text-zinc-400 leading-relaxed">
              Purpose-built communications platform for schools and educational organizations.
            </p>
            <p className="text-[11px] text-zinc-300">SMS · Email · WhatsApp</p>
          </div>

          <div className="flex gap-12 sm:gap-16 shrink-0 flex-wrap">
            <nav className="flex flex-col gap-2.5" aria-label="Platform">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Platform</p>
              <a href="#features"      className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">Features</a>
              <a href="#how-it-works"  className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">How it works</a>
              <a href="#about"         className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">About</a>
              <a href="#contact"       className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">Contact</a>
            </nav>
            <nav className="flex flex-col gap-2.5" aria-label="Legal">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Legal</p>
              <Link href="/privacy"    className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">Privacy Policy</Link>
              <Link href="/sms-terms"  className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">SMS Terms</Link>
              <Link href="/terms"      className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">Terms of Service</Link>
              <Link href="/cta"        className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">CTA Documentation</Link>
            </nav>
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">Contact</p>
              <a href={`mailto:${CONTACT_EMAIL}`}  className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-colors">{CONTACT_EMAIL}</a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-400">© {year} Kesher. All rights reserved.</p>
          <p className="text-[11px] text-zinc-300">
            Kesher is not affiliated with any individual school. Schools are responsible for obtaining and maintaining consent records.
          </p>
        </div>
      </div>
    </footer>
  );
}
