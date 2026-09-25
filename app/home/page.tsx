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
  { Icon: Smartphone,    label: "SMS",      color: "text-info",    bg: "bg-info-tint",    border: "border-info-border"    },
  { Icon: Mail,          label: "Email",    color: "text-text-secondary",    bg: "bg-background",    border: "border-border"    },
  { Icon: MessageSquare, label: "WhatsApp", color: "text-success", bg: "bg-success-tint", border: "border-success-border" },
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
    <div className="theme-light min-h-screen bg-surface flex flex-col">
      <LandingNav />
      <div className="flex-1">
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
      </div>
      <LandingFooter />
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">

        {/* Wordmark */}
        <Link href="/home" className="flex items-center gap-2.5 group shrink-0" aria-label="Kesher home">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary group-hover:bg-primary-hover transition-colors">
            <span className="text-[11px] font-bold text-primary-fg tracking-tight select-none">K</span>
          </div>
          <span className="text-[13px] font-semibold text-text-primary tracking-tight">Kesher</span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-5 flex-1" aria-label="Main navigation">
          <a href="#features"     className="text-[13px] text-text-muted hover:text-text-primary transition-colors">Features</a>
          <a href="#how-it-works" className="text-[13px] text-text-muted hover:text-text-primary transition-colors">How it works</a>
          <a href="#compliance"   className="text-[13px] text-text-muted hover:text-text-primary transition-colors">Compliance</a>
          <a href="#contact"      className="text-[13px] text-text-muted hover:text-text-primary transition-colors">Contact</a>
        </nav>

        {/* CTA */}
        <a
          href={DEMO_MAILTO}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-fg hover:bg-primary-hover transition-colors"
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
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 mb-7">
          <div className="h-1.5 w-1.5 rounded-full bg-success-solid" />
          <span className="text-[11px] font-medium text-text-secondary tracking-wide">Purpose-built for schools</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-[62px] font-semibold tracking-[-0.03em] leading-[1.07] text-text-primary mb-5">
          Reach every parent.<br />
          Every student.<br className="hidden sm:block" />
          Every time.
        </h1>

        {/* Sub-headline */}
        <p className="text-[18px] text-text-muted leading-relaxed max-w-xl mx-auto mb-8">
          Kesher gives school administrators one place to communicate with their entire community —
          via SMS, email, and WhatsApp — without managing multiple tools or worrying about compliance.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={DEMO_MAILTO}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-fg hover:bg-primary-hover transition-colors"
          >
            Request a demo
            <ArrowRight size={14} strokeWidth={2} />
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-5 py-2.5 text-[14px] font-medium text-text-secondary hover:border-border-strong hover:bg-surface-hover transition-colors"
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
        <div className="rounded-xl border border-border overflow-hidden shadow-[0_8px_48px_rgba(0,0,0,0.10)]">
          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-surface-2">
            <div className="h-2.5 w-2.5 rounded-full bg-surface-3" />
            <div className="h-2.5 w-2.5 rounded-full bg-surface-3" />
            <div className="h-2.5 w-2.5 rounded-full bg-surface-3" />
            <div className="ml-4 flex items-center gap-2 flex-1 max-w-xs rounded-md bg-surface border border-border px-3 h-6">
              <div className="h-1.5 w-1.5 rounded-full bg-border-strong" />
              <span className="text-[10px] text-text-subtle">kesherhq.co/dashboard</span>
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
    sms:   { bg: "bg-info-tint",    text: "text-info",    label: "SMS"   },
    email: { bg: "bg-surface-2",   text: "text-text-muted",    label: "Email" },
  };

  return (
    <div className="flex bg-background" style={{ minHeight: 400 }}>

      {/* ── Sidebar ── */}
      <div className="w-[210px] shrink-0 border-r border-border bg-surface-2 flex flex-col hidden sm:flex">
        {/* Wordmark */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-[6px] bg-primary flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-primary-fg">K</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-text-primary leading-none">Kesher</p>
              <p className="text-[9px] text-text-subtle leading-none mt-0.5">School Comms</p>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="px-4 pb-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-text-subtle">Navigation</p>
        </div>

        {/* Nav items */}
        <div className="flex-1 px-2 space-y-0.5">
          {sidebarItems.map(({ label, Icon, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium ${
                active
                  ? "bg-accent-tint text-accent"
                  : "text-text-muted"
              }`}
            >
              <Icon
                size={12}
                strokeWidth={active ? 2 : 1.75}
                className={active ? "text-accent" : "text-text-subtle"}
              />
              {label}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="px-2 py-2 border-t border-border-subtle">
          <div className="flex items-center gap-2 rounded-md px-2.5 py-[5px] text-[11px] font-medium text-text-subtle">
            <Settings size={12} strokeWidth={1.75} className="text-text-faint" />
            Settings
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Page header */}
        <div className="sticky top-0 border-b border-border bg-surface/95 px-5 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-text-primary">Overview</p>
            <p className="text-[9px] text-text-subtle mt-px">Your School</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1">
            <PenLine size={10} strokeWidth={2} className="text-primary-fg" />
            <span className="text-[10px] font-medium text-primary-fg">Compose</span>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { label: "Active Contacts", value: "412",   sub: "in directory"      },
              { label: "This Week",       value: "3",     sub: "campaigns sent"     },
              { label: "Delivery Rate",   value: "97.6%", sub: "last 30 days",  accent: "border-t-2 border-t-success-solid" },
              { label: "Open Rate",       value: "64.2%", sub: "email, last 30d", accent: "border-t-2 border-t-info-solid"  },
            ].map(({ label, value, sub, accent }) => (
              <div
                key={label}
                className={`rounded-xl border border-border bg-surface px-3.5 py-3 ${accent ?? ""}`}
              >
                <p className="text-[8px] font-semibold uppercase tracking-wider text-text-subtle">{label}</p>
                <p className="mt-1.5 text-[22px] font-semibold tracking-tight tabular-nums leading-none text-text-primary">{value}</p>
                <p className="mt-1.5 text-[9px] text-text-subtle">{sub}</p>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div>
                <p className="text-[11px] font-semibold text-text-primary">Activity</p>
                <p className="text-[9px] text-text-subtle mt-px">Campaigns and imports</p>
              </div>
              <span className="text-[9px] font-medium text-text-subtle">View all →</span>
            </div>
            {feedItems.map((item, i) => {
              const ch = channelColor[item.channel] ?? channelColor.sms;
              const isLast = i === feedItems.length - 1;
              return (
                <div key={item.subject} className={`flex items-center gap-3 px-4 py-3 ${!isLast ? "border-b border-border-subtle" : ""}`}>
                  <div className="h-6 w-6 rounded-full bg-success-tint flex items-center justify-center shrink-0">
                    <CheckCircle2 size={10} className="text-success" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-[11px] font-medium text-text-primary truncate">{item.subject}</p>
                      <span className={`shrink-0 rounded-full px-1.5 py-px text-[8px] font-semibold ${ch.bg} ${ch.text}`}>
                        {ch.label}
                      </span>
                    </div>
                    <p className="text-[9px] text-text-subtle mt-px">
                      {item.audience} · {item.recipients} recipients · {item.status}
                    </p>
                  </div>
                  <span className="text-[9px] tabular-nums text-text-subtle shrink-0">{item.time}</span>
                </div>
              );
            })}
          </div>

          {/* Quick actions row */}
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle">
              <p className="text-[11px] font-semibold text-text-primary">Quick Actions</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border-subtle">
              {[
                { Icon: PenLine,  label: "Compose",         sub: "Send to any audience" },
                { Icon: Upload,   label: "Import Contacts", sub: "Upload a CSV"         },
                { Icon: UserPlus, label: "Add Contact",     sub: "Add a single person"  },
                { Icon: Layers,   label: "Audiences",       sub: "Manage groups"        },
              ].map(({ Icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2.5 px-4 py-3">
                  <div className="h-7 w-7 shrink-0 rounded-lg border border-border bg-surface flex items-center justify-center">
                    <Icon size={11} className="text-text-muted" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-text-primary">{label}</p>
                    <p className="text-[9px] text-text-subtle">{sub}</p>
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
    <section className="border-y border-border-subtle bg-background py-5 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {[
            { text: "Built specifically for K–12 schools and educational organizations" },
            { text: "Not adapted from a general-purpose marketing tool" },
            { text: "Compliance built in — not bolted on" },
          ].map(({ text }) => (
            <div key={text} className="flex items-center gap-2 text-[13px] text-text-secondary">
              <CheckCircle2 size={14} className="text-text-subtle shrink-0" strokeWidth={2} />
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-3">Platform</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.1]">
            Everything your school needs to stay connected
          </h2>
          <p className="text-[16px] text-text-muted leading-relaxed">
            Kesher replaces the patchwork of email blasts, group texts, and manual lists that most schools
            rely on. One platform, every channel, for every part of your community.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 mb-6">
          {FEATURES.map(({ Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-border bg-surface p-6 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background mb-4">
                <Icon size={16} className="text-text-secondary" strokeWidth={1.75} />
              </div>
              <h3 className="text-[15px] font-semibold text-text-primary mb-2">{title}</h3>
              <p className="text-[14px] text-text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Channel breakdown */}
        <div className="rounded-xl border border-border bg-background p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle mb-5">Supported Channels</p>
          <div className="grid sm:grid-cols-3 gap-6">
            {CHANNELS.map(({ Icon, label, color, bg, border }) => (
              <div key={label} className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${bg} ${border}`}>
                  <Icon size={15} className={color} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-text-primary">{label}</p>
                  <p className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
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
    <section id="how-it-works" className="py-24 px-6 bg-background border-y border-border-subtle">
      <div className="max-w-6xl mx-auto">

        <div className="max-w-xl mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-3">How It Works</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.1]">
            From contact list to delivered message in minutes
          </h2>
          <p className="text-[16px] text-text-muted leading-relaxed">
            Kesher is designed for school administrators, not developers. No setup complexity, no integrations to configure.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-10">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <div key={step} className="flex flex-col gap-4">
              <div className="text-[11px] font-semibold font-mono text-text-subtle tracking-widest">{step}</div>
              <div className="h-px bg-border-strong w-full" />
              <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
              <p className="text-[14px] text-text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Consent enforcement callout */}
        <div className="mt-12 rounded-xl border border-warning-border bg-warning-tint px-6 py-5 flex gap-4">
          <AlertCircle size={16} className="text-warning shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="text-[13px] font-semibold text-warning mb-1">Consent certification is required before any import</p>
            <p className="text-[13px] text-warning leading-relaxed">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-4">About Kesher</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-text-primary mb-5 leading-[1.2]">
              Built because schools deserve better than group texts and mass emails
            </h2>
            <div className="space-y-4 text-[15px] text-text-muted leading-relaxed">
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-5">Who Kesher Is For</p>
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
                <div key={label} className="rounded-xl border border-border bg-background p-5">
                  <p className="text-[13px] font-semibold text-text-primary mb-1.5">{label}</p>
                  <p className="text-[13px] text-text-muted leading-relaxed">{body}</p>
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
    <section className="py-24 px-6 bg-background border-y border-border-subtle">
      <div className="max-w-6xl mx-auto">

        <div className="max-w-xl mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-3">What Gets Sent</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.1]">
            School communications, not marketing
          </h2>
          <p className="text-[16px] text-text-muted leading-relaxed">
            Kesher is used exclusively for transactional and informational school communications. The platform does
            not support marketing, promotional, political, or commercial messaging of any kind.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-5">
          {SAMPLE_MESSAGES.map(({ label, channel, text }) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-subtle">{label}</p>
                <span className="text-[9px] font-semibold uppercase tracking-wide text-info bg-info-tint rounded-full px-2 py-0.5">{channel}</span>
              </div>
              {/* SMS thread mockup */}
              <div className="space-y-1">
                <div className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 max-w-[95%]">
                    <p className="text-[12px] text-primary-fg leading-relaxed">{text}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 justify-end mt-1">
                  <CheckCircle2 size={9} className="text-text-faint" strokeWidth={2} />
                  <span className="text-[9px] text-text-subtle">Delivered</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[12px] text-text-subtle text-center">
          Representative examples only. Full message type documentation:{" "}
          <Link href="/cta" className="text-text-secondary hover:text-text-primary underline underline-offset-2">CTA Documentation</Link>.
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-3">Compliance</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.1]">
            Meets carrier and regulatory standards
          </h2>
          <p className="text-[16px] text-text-muted leading-relaxed">
            Every SMS message sent through Kesher complies with CTIA Messaging Principles and Best Practices,
            TCPA requirements, and 10DLC registration guidelines. Kesher acts as a messaging service provider;
            each school is the Message Originator and is responsible for obtaining and maintaining consent records.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 mb-6">
          {COMPLIANCE_ITEMS.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border">
                  <Icon size={16} className="text-text-secondary" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-text-primary mb-1.5">{title}</h3>
                  <p className="text-[13px] text-text-muted leading-relaxed">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Doc links */}
        <div className="rounded-xl border border-border bg-background px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle mb-4">Compliance Documentation</p>
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
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-[12px] font-medium text-text-secondary hover:border-border-strong hover:bg-surface-hover transition-colors"
              >
                <FileText size={12} strokeWidth={1.75} className="text-text-subtle" />
                {label}
                <ChevronRight size={11} strokeWidth={2} className="text-text-faint" />
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
    <section className="py-10 px-6 bg-background border-y border-border-subtle">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-xl border border-border bg-surface p-7 sm:p-9">
          <div className="max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-4">
              For Carrier &amp; Compliance Reviewers
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-text-primary mb-3">
              Platform overview — Sinch, TCR, and carrier review
            </h2>
            <p className="text-[14px] text-text-muted leading-relaxed mb-5">
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
                <div key={label} className="flex gap-4 py-2 border-b border-border-subtle last:border-0">
                  <span className="w-32 shrink-0 text-[12px] font-semibold text-text-muted">{label}</span>
                  <span className="text-[12px] text-text-secondary leading-relaxed">{value}</span>
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-2 transition-colors"
                >
                  <FileText size={12} strokeWidth={1.75} className="text-text-subtle" />
                  {label}
                </Link>
              ))}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface-2 transition-colors"
              >
                <Mail size={12} strokeWidth={1.75} className="text-text-subtle" />
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-4">Contact</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] text-text-primary mb-4 leading-[1.2]">
              Get in touch
            </h2>
            <p className="text-[15px] text-text-muted leading-relaxed mb-8">
              We work with schools directly. Whether you want to see a demo, have questions about how Kesher
              works, or want to get your school set up — reach out and we'll respond promptly.
            </p>
            <div className="space-y-4">
              <a
                href={DEMO_MAILTO}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 hover:border-border-strong hover:shadow-sm transition-all duration-150 group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-background flex items-center justify-center">
                  <Send size={16} className="text-text-secondary" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary">Request a Demo</p>
                  <p className="text-[12px] text-text-muted">{CONTACT_EMAIL}</p>
                </div>
                <ArrowRight size={14} className="text-text-faint group-hover:text-text-muted shrink-0 transition-colors" strokeWidth={2} />
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-5 py-4 hover:border-border-strong hover:shadow-sm transition-all duration-150 group"
              >
                <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-background flex items-center justify-center">
                  <Mail size={16} className="text-text-secondary" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary">Questions &amp; Support</p>
                  <p className="text-[12px] text-text-muted">{CONTACT_EMAIL}</p>
                </div>
                <ArrowRight size={14} className="text-text-faint group-hover:text-text-muted shrink-0 transition-colors" strokeWidth={2} />
              </a>
            </div>
          </div>

          {/* Right — FAQ-style trust signals */}
          <div className="space-y-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle mb-5">Common Questions</p>
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
                <p className="text-[13px] text-text-muted leading-relaxed">{a}</p>
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
    <section className="py-24 px-6 bg-primary">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-semibold tracking-[-0.03em] text-primary-fg mb-5 leading-[1.1]">
          Bring your school<br className="hidden sm:block" /> community together
        </h2>
        <p className="text-[16px] text-text-subtle leading-relaxed mb-10 max-w-lg mx-auto">
          Kesher works with schools directly. Reach out to schedule a demo or ask about getting your
          school set up — we'll get back to you promptly.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={DEMO_MAILTO}
            className="inline-flex items-center gap-2 rounded-lg bg-surface px-5 py-2.5 text-[14px] font-medium text-text-primary hover:bg-surface-2 transition-colors"
          >
            Request a demo
            <ArrowRight size={14} strokeWidth={2} />
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-lg border border-primary px-5 py-2.5 text-[14px] font-medium text-text-subtle hover:border-border-strong hover:text-on-solid transition-colors"
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
    <footer className="border-t border-border-subtle bg-surface">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">

          <div className="flex flex-col gap-3 max-w-[220px]">
            <div className="inline-flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary">
                <span className="text-[11px] font-bold text-primary-fg tracking-tight select-none">K</span>
              </div>
              <span className="text-[13px] font-semibold text-text-primary tracking-tight">Kesher</span>
            </div>
            <p className="text-[12px] text-text-subtle leading-relaxed">
              Purpose-built communications platform for schools and educational organizations.
            </p>
            <p className="text-[11px] text-text-subtle">SMS · Email · WhatsApp</p>
          </div>

          <div className="flex gap-12 sm:gap-16 shrink-0 flex-wrap">
            <nav className="flex flex-col gap-2.5" aria-label="Platform">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle mb-0.5">Platform</p>
              <a href="#features"      className="text-[12px] text-text-muted hover:text-text-primary transition-colors">Features</a>
              <a href="#how-it-works"  className="text-[12px] text-text-muted hover:text-text-primary transition-colors">How it works</a>
              <a href="#about"         className="text-[12px] text-text-muted hover:text-text-primary transition-colors">About</a>
              <a href="#contact"       className="text-[12px] text-text-muted hover:text-text-primary transition-colors">Contact</a>
            </nav>
            <nav className="flex flex-col gap-2.5" aria-label="Legal">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle mb-0.5">Legal</p>
              <Link href="/privacy"    className="text-[12px] text-text-muted hover:text-text-primary transition-colors">Privacy Policy</Link>
              <Link href="/sms-terms"  className="text-[12px] text-text-muted hover:text-text-primary transition-colors">SMS Terms</Link>
              <Link href="/terms"      className="text-[12px] text-text-muted hover:text-text-primary transition-colors">Terms of Service</Link>
              <Link href="/cta"        className="text-[12px] text-text-muted hover:text-text-primary transition-colors">CTA Documentation</Link>
            </nav>
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle mb-0.5">Contact</p>
              <a href={`mailto:${CONTACT_EMAIL}`}  className="text-[12px] text-text-muted hover:text-text-primary transition-colors">{CONTACT_EMAIL}</a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="text-[11px] text-text-subtle">© {year} Kesher. All rights reserved.</p>
          <p className="text-[11px] text-text-subtle">
            Kesher is not affiliated with any individual school. Schools are responsible for obtaining and maintaining consent records.
          </p>
        </div>
      </div>
    </footer>
  );
}
