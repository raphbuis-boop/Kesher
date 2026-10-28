"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Smartphone,
  MessageSquare,
  Download,
  Copy,
  Search,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Send,
  Clock,
  Users,
  Reply,
  BookOpen,
  Activity,
  Info,
  MousePointerClick,
  CheckCheck,
  AlertTriangle,
} from "lucide-react";
import type { CampaignLinks, CampaignMessage, CampaignRecipient, ChartBucket } from "./page";
import { CONFIRMED_EXPLAINER, OPENED_EXPLAINER, OPENED_LABEL, READ_EXPLAINER } from "@/lib/tracking";
import { ResendUnread } from "./ResendUnread";

// ─── types ──────────────────────────────────────────────────────────────────

type RecipientStatus =
  | "confirmed"
  | "replied"
  | "read"
  | "clicked"
  | "opened"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "retried"
  | "opted_out"
  | "queued"
  | "sent";

type FilterKey = "all" | "delivered" | "confirmed" | "unseen" | "opened" | "read" | "replied" | "failed";

type Chan = "email" | "sms" | "whatsapp";

// ─── helpers ────────────────────────────────────────────────────────────────

const RECIPIENTS_PAGE = 100;

const CHANNEL_META: Record<
  string,
  { label: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>; color: string; bg: string }
> = {
  email:    { label: "Email",    icon: Mail,          color: "text-ink-2",    bg: "bg-muted"   },
  sms:      { label: "SMS",      icon: Smartphone,    color: "text-blue-500",    bg: "bg-blue-50"      },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-50"   },
  multi:    { label: "Multi-channel", icon: Send,     color: "text-ink-2",       bg: "bg-muted"        },
};

const CATEGORY_LABELS: Record<string, string> = {
  parent: "Parent", student: "Student", grandparent: "Grandparent",
  alumni: "Alumni", faculty: "Faculty", staff: "Staff",
  board: "Board", donor: "Donor", prospect: "Prospect",
};

/** The channel a row was sent on (older single-channel messages have it on the message). */
function rowChannel(r: CampaignRecipient, message: CampaignMessage): Chan {
  const c = r.channel ?? message.channel;
  return c === "sms" || c === "whatsapp" ? c : "email";
}

/** Highest-confidence thing we know about this row. "Retried" = failed, but the message went out on another channel. */
function recipientStatus(r: CampaignRecipient, retried: Set<string>): RecipientStatus {
  if (r.status === "opted_out") return "opted_out";
  if (r.complained_at)       return "complained";
  if (r.bounced_at && !retried.has(r.id)) return "bounced";
  if (r.status === "failed") return retried.has(r.id) ? "retried" : "failed";
  if (r.confirmed_at)        return "confirmed";
  if (r.replied_at)          return "replied";
  if (r.read_at)             return "read";
  if (r.clicked_at)          return "clicked";
  if (r.opened_at)           return "opened";
  if (r.delivered_at)        return "delivered";
  if (r.status === "queued" || r.status === "sending") return "queued";
  return "sent";
}

const STATUS_META: Record<RecipientStatus, { label: string; textColor: string; bg: string; dot: string }> = {
  confirmed: { label: "Confirmed", textColor: "text-emerald-800", bg: "bg-emerald-100", dot: "bg-emerald-600" },
  replied:   { label: "Replied",   textColor: "text-violet-700",  bg: "bg-violet-50",  dot: "bg-violet-500"  },
  read:      { label: "Read",      textColor: "text-blue-700",    bg: "bg-blue-50",    dot: "bg-blue-500"    },
  clicked:   { label: "Clicked",   textColor: "text-sky-700",     bg: "bg-sky-50",     dot: "bg-sky-500"     },
  opened:    { label: OPENED_LABEL, textColor: "text-sky-700",    bg: "bg-sky-50",     dot: "bg-sky-400"     },
  delivered: { label: "Delivered", textColor: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  bounced:   { label: "Bounced",   textColor: "text-amber-700",   bg: "bg-amber-50",   dot: "bg-amber-500"   },
  complained:{ label: "Spam",      textColor: "text-orange-700",  bg: "bg-orange-50",  dot: "bg-orange-500"  },
  failed:    { label: "Failed",    textColor: "text-red-600",     bg: "bg-red-50",     dot: "bg-red-500"     },
  retried:   { label: "Sent another way", textColor: "text-ink-2", bg: "bg-muted",     dot: "bg-ink-3"       },
  opted_out: { label: "Opted out", textColor: "text-rose-700",    bg: "bg-rose-50",    dot: "bg-rose-500"    },
  queued:    { label: "Waiting to send", textColor: "text-ink-2", bg: "bg-muted",      dot: "bg-ink-3"       },
  sent:      { label: "Sent",      textColor: "text-ink-2",   bg: "bg-muted", dot: "bg-ink-3"  },
};

const ACCENT: Record<string, string> = {
  emerald: "border-t-2 border-t-emerald-500",
  blue:    "border-t-2 border-t-blue-500",
  sky:     "border-t-2 border-t-sky-500",
  violet:  "border-t-2 border-t-violet-500",
  red:     "border-t-2 border-t-red-500",
  amber:   "border-t-2 border-t-amber-500",
};

function fmt(ts: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!ts) return null;
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...opts,
  });
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function fmtRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return fmt(ts) ?? "";
}

function lastActivity(r: CampaignRecipient): string | null {
  return (
    [r.confirmed_at, r.replied_at, r.complained_at, r.clicked_at, r.opened_at, r.read_at, r.bounced_at, r.delivered_at, r.sent_at]
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null
  );
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function csvCell(v: string | null | undefined): string {
  const t = v ?? "";
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function exportCSV(recipients: CampaignRecipient[], message: CampaignMessage, retried: Set<string>) {
  const iso = (ts: string | null) => (ts ? new Date(ts).toISOString() : "");
  const header = ["Name", "Channel", "Contact", "Status", "Delivered", `${OPENED_LABEL}`, "Clicked", "Read (WhatsApp)", "Confirmed", "Replied", "Bounced", "Error"].join(",");
  const rows = recipients
    .map((r) =>
      [
        csvCell(r.name),
        rowChannel(r, message),
        csvCell(r.contact_value),
        STATUS_META[recipientStatus(r, retried)].label,
        iso(r.delivered_at),
        iso(r.opened_at),
        iso(r.clicked_at),
        iso(r.read_at),
        iso(r.confirmed_at),
        iso(r.replied_at),
        iso(r.bounced_at),
        csvCell(r.error_detail),
      ].join(",")
    )
    .join("\n");

  const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `message-${(message.subject ?? "export").replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── useCountUp hook ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    let startTime: number | null = null;
    function step(ts: number) {
      if (startTime === null) startTime = ts;
      const t = target === 0 ? 1 : Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val;
}

// ─── useReveal hook (chart animation) ────────────────────────────────────────

function useReveal(duration = 1200) {
  const [pct, setPct] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    let start: number | null = null;
    function step(ts: number) {
      if (start === null) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setPct(eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [duration]);

  return pct;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, accent, index = 0, info,
}: {
  label: string; value: number; sub?: string; accent?: string; index?: number; info?: string;
}) {
  const count = useCountUp(value, 650);

  return (
    <div
      className={[
        "rounded-xl border border-line bg-card px-4 py-4 transition-all duration-200 hover:shadow-sm hover:border-line-strong animate-fade-up",
        accent ?? "",
      ].filter(Boolean).join(" ")}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
        {label}
        {info && (
          <span title={info} className="cursor-help text-ink-3 normal-case" aria-label={info}>
            <Info size={11} strokeWidth={2} />
          </span>
        )}
      </p>
      <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-ink">
        {count.toLocaleString()}
      </p>
      {sub && <p className="mt-2 text-[11px] text-ink-3 leading-tight">{sub}</p>}
    </div>
  );
}

// ─── KPI grid ────────────────────────────────────────────────────────────────

type KPIStats = {
  /** Distinct people */
  people: number;
  /** Messages (a person on two channels has two) */
  rows: number;
  delivered: number;
  emailRows: number; emailDelivered: number; opened: number; clicked: number;
  waRows: number; waDelivered: number; read: number;
  replied: number;
  /** People who tapped "I've read this" */
  confirmed: number;
  /** People who confirmed or read on WhatsApp */
  seen: number;
  failed: number;
  usesConfirm: boolean;
};

function KPIGrid({ stats }: { stats: KPIStats }) {
  const cards: { label: string; value: number; sub?: string; accent?: string; info?: string }[] = [
    { label: "People", value: stats.people, sub: stats.rows !== stats.people ? `${stats.rows.toLocaleString()} messages across channels` : undefined },
    { label: "Delivered", value: stats.delivered, sub: pct(stats.delivered, stats.rows) + " of messages", accent: ACCENT.emerald },
  ];
  if (stats.usesConfirm || stats.confirmed > 0) {
    cards.push({ label: "Confirmed", value: stats.confirmed, sub: `${pct(stats.confirmed, stats.people)} of people tapped "I've read this"`, accent: ACCENT.emerald, info: CONFIRMED_EXPLAINER });
  }
  if (stats.waRows > 0) {
    cards.push({ label: "Read (WhatsApp)", value: stats.read, sub: `${pct(stats.read, stats.waDelivered)} of ${stats.waDelivered.toLocaleString()} delivered`, accent: stats.read > 0 ? ACCENT.blue : undefined, info: READ_EXPLAINER });
  }
  if (stats.emailRows > 0) {
    cards.push({ label: OPENED_LABEL, value: stats.opened, sub: `${pct(stats.opened, stats.emailDelivered)} of ${stats.emailDelivered.toLocaleString()} emails`, accent: stats.opened > 0 ? ACCENT.sky : undefined, info: OPENED_EXPLAINER });
    if (stats.clicked > 0) cards.push({ label: "Clicked", value: stats.clicked, sub: "Link scanners are ignored", accent: ACCENT.sky });
  }
  if (stats.replied > 0) cards.push({ label: "Replied", value: stats.replied, accent: ACCENT.violet });
  cards.push({ label: "Failed", value: stats.failed, sub: stats.failed > 0 ? "No working channel reached them" : "Everyone was reached", accent: stats.failed > 0 ? ACCENT.red : undefined });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {cards.map((c, i) => <KPICard key={c.label} {...c} index={i} />)}
    </div>
  );
}

// ─── Live Progress Banner ─────────────────────────────────────────────────────

function LiveProgressBanner({ message, stats }: { message: CampaignMessage; stats: KPIStats }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const sentAt    = message.sent_at ?? message.created_at;
  const [now] = useState(() => Date.now());
  const ageMs     = now - new Date(sentAt).getTime();
  const isFresh   = ageMs < 2 * 60 * 60 * 1000;
  const delivPct  = stats.rows > 0 ? stats.delivered / stats.rows : 0;
  const isComplete = delivPct >= 0.95 || !isFresh;

  const shouldShow = !dismissed && stats.rows > 0 && (message.status === "sending" || isFresh);

  useEffect(() => {
    if (!shouldShow || isComplete) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [shouldShow, isComplete, router]);

  if (!shouldShow) return null;

  const barPct  = stats.rows > 0 ? Math.round((stats.delivered / stats.rows) * 100) : 0;
  const engCount = stats.seen;
  const engLabel = "confirmed or read";

  return (
    <div className="rounded-xl border border-line bg-card shadow-card px-5 py-4 animate-fade-up" style={{ animationDelay: "0ms" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {isComplete ? (
            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" strokeWidth={2} />
          ) : (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          <span className="text-[13px] font-semibold text-ink">
            {isComplete ? "Delivered" : "Sending in progress"}
          </span>
          {!isComplete && (
            <span className="text-[11px] text-ink-3">· updates every 10s</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] tabular-nums font-medium text-ink">{barPct}%</span>
          {isComplete && (
            <button
              onClick={() => setDismissed(true)}
              className="rounded p-0.5 text-ink-3 hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted-2">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-ink-2">
            <span className="tabular-nums font-semibold text-ink">{stats.delivered.toLocaleString()}</span>
            {" / "}{stats.rows.toLocaleString()} delivered
          </span>
        </div>
        {engCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span className="text-[11px] text-ink-2">
              <span className="tabular-nums font-semibold text-ink">{engCount.toLocaleString()}</span>
              {" "}{engLabel}
            </span>
          </div>
        )}
        {stats.failed > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            <span className="text-[11px] text-ink-2">
              <span className="tabular-nums font-semibold text-red-600">{stats.failed.toLocaleString()}</span>
              {" "}failed
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed({
  recipients,
  message,
}: {
  recipients: CampaignRecipient[];
  message: CampaignMessage;
}) {

  const events = useMemo(() => {
    const evs: Array<{
      label: string;
      time: string;
      color: string;
      bg: string;
      icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
    }> = [];

    for (const r of recipients) {
      const name = r.name.split(" ")[0];
      if (r.replied_at && r.status === "opted_out") {
        evs.push({ label: `${name} opted out (replied STOP)`, time: r.replied_at, color: "text-rose-600", bg: "bg-rose-50", icon: XCircle });
      } else if (r.replied_at) {
        evs.push({ label: `${name} replied`, time: r.replied_at, color: "text-violet-600", bg: "bg-violet-50", icon: Reply });
      }
      if (r.confirmed_at) {
        evs.push({ label: `${name} confirmed they read it`, time: r.confirmed_at, color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCheck });
      }
      if (r.clicked_at) {
        evs.push({ label: `${name} clicked a link`, time: r.clicked_at, color: "text-sky-600", bg: "bg-sky-50", icon: MousePointerClick });
      }
      if (r.opened_at) {
        evs.push({ label: `${name}'s email was opened (may be automatic)`, time: r.opened_at, color: "text-sky-600", bg: "bg-sky-50", icon: Eye });
      }
      if (r.read_at) {
        evs.push({ label: `${name} read the WhatsApp message`, time: r.read_at, color: "text-blue-600", bg: "bg-blue-50", icon: BookOpen });
      }
      if (r.bounced_at) {
        evs.push({ label: `${name}'s message bounced`, time: r.bounced_at, color: "text-amber-600", bg: "bg-amber-50", icon: AlertCircle });
      }
      if (r.complained_at) {
        evs.push({ label: `${name} marked as spam`, time: r.complained_at, color: "text-orange-600", bg: "bg-orange-50", icon: XCircle });
      }
    }

    return evs
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);
  }, [recipients]);
  void message;

  return (
    <div className="rounded-xl border border-line bg-card shadow-card px-5 py-5 flex flex-col animate-fade-up" style={{ animationDelay: "280ms" }}>
      <div className="mb-4 flex-shrink-0">
        <h2 className="text-[13px] font-semibold text-ink">Activity</h2>
        <p className="mt-0.5 text-[11px] text-ink-3">Most recent engagement events</p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-canvas mb-3">
            <Activity size={15} className="text-line-strong" strokeWidth={1.5} />
          </div>
          <p className="text-[12px] font-medium text-ink-2">Waiting for activity</p>
          <p className="mt-0.5 text-[11px] text-ink-3">
            Confirmations, read receipts, replies and bounces will appear here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-muted" style={{ maxHeight: 220 }}>
          {events.map((ev, i) => {
            const Icon = ev.icon;
            return (
              <div key={i} className="flex items-start gap-3 py-2.5 first:pt-0">
                <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${ev.bg}`}>
                  <Icon size={11} strokeWidth={2} className={ev.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-ink leading-snug">{ev.label}</p>
                  <p className="mt-0.5 text-[10px] text-ink-3">{fmtRelative(ev.time)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Timeline chart ───────────────────────────────────────────────────────────

function TimelineChart({ data }: { data: ChartBucket[] }) {
  // Hook must be called before any early return
  const revealPct = useReveal(1100);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const hasDelivered = data.some((b) => b.delivered > 0);
  const hasOpened    = data.some((b) => b.opened  > 0);
  const hasRead      = data.some((b) => b.read    > 0);
  const hasReplied   = data.some((b) => b.replied > 0);

  if (!hasDelivered) {
    return (
      <div className="flex h-[160px] flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-canvas">
          <Clock size={18} className="text-line-strong" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-medium text-ink">Awaiting delivery events</p>
          <p className="mt-0.5 text-[12px] text-ink-3">Events will appear as recipients receive the message.</p>
        </div>
      </div>
    );
  }

  const W = 600, H = 160;
  const PAD = { top: 16, right: 20, bottom: 32, left: 44 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((b) => b.delivered), 1);
  const xS = (i: number) => PAD.left + (i / (data.length - 1)) * iW;
  const yS = (v: number) => PAD.top + iH - (v / maxVal) * iH;

  const linePath = (key: keyof ChartBucket) =>
    data.map((b, i) => `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)},${yS(b[key] as number).toFixed(1)}`).join(" ");

  const areaPath = (key: keyof ChartBucket) => {
    const l = linePath(key);
    const bx = (PAD.top + iH).toFixed(1);
    return `${l} L${xS(data.length - 1).toFixed(1)},${bx} L${xS(0).toFixed(1)},${bx} Z`;
  };

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const xTicks = [0, 6, 12, 18, 23];

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const svgX = ratio * W;
    const dataX = (svgX - PAD.left) / iW;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(dataX * (data.length - 1))));
    setHoverIdx(idx);
  };

  const hBucket = hoverIdx !== null ? data[hoverIdx] : null;
  const extraLines = [hasOpened, hasRead, hasReplied].filter(Boolean).length;
  const ttH = 18 + 14 + extraLines * 14 + 4;
  const ttW = 124;
  const ttX = hoverIdx !== null
    ? (xS(hoverIdx) > W / 2 ? xS(hoverIdx) - ttW - 10 : xS(hoverIdx) + 10)
    : 0;
  const ttY = PAD.top + 2;

  // clipPath width animated via revealPct
  const clipW = iW * revealPct;

  return (
    <div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }} aria-hidden>
        <defs>
          <linearGradient id="grad-del" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
          <clipPath id="chart-reveal">
            <rect x={PAD.left} y={0} width={clipW} height={H} />
          </clipPath>
          <filter id="tt-shadow" x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000012" />
          </filter>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line key={`grid-${i}-${v}`} x1={PAD.left} x2={W - PAD.right} y1={yS(v)} y2={yS(v)}
            stroke="var(--app-muted-2)" strokeWidth="1" />
        ))}

        {/* Animated chart paths */}
        <g clipPath="url(#chart-reveal)">
          <path d={areaPath("delivered")} fill="url(#grad-del)" />
          <path d={linePath("delivered")} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hasOpened && (
            <path d={linePath("opened")} fill="none" stroke="#0ea5e9" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {hasRead && (
            <path d={linePath("read")} fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {hasReplied && (
            <path d={linePath("replied")} fill="none" stroke="#8b5cf6" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          )}
        </g>

        {/* Axes */}
        {xTicks.map((i) => (
          <text key={i} x={xS(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--app-ink-3)">
            {i === 0 ? "0h" : i === 23 ? "24h" : `${i}h`}
          </text>
        ))}
        {yTicks.filter((v) => v > 0).map((v, i) => (
          <text key={`ytick-${i}-${v}`} x={PAD.left - 7} y={yS(v) + 3} textAnchor="end" fontSize="9" fill="var(--app-ink-3)">
            {v}
          </text>
        ))}

        {/* Hover interaction layer */}
        <rect x={PAD.left} y={PAD.top} width={iW} height={iH}
          fill="transparent" style={{ cursor: "crosshair" }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)} />

        {/* Hover elements */}
        {hoverIdx !== null && hBucket && (() => {
          const cx = xS(hoverIdx);
          let ttLine = 27;
          return (
            <g>
              <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + iH}
                stroke="var(--app-line-strong)" strokeWidth="1" strokeDasharray="3,2" />
              <circle cx={cx} cy={yS(hBucket.delivered)} r="4" fill="var(--app-card)" stroke="#10b981" strokeWidth="2" />
              {hasOpened && hBucket.opened > 0 && (
                <circle cx={cx} cy={yS(hBucket.opened)} r="4" fill="var(--app-card)" stroke="#0ea5e9" strokeWidth="2" />
              )}
              {hasRead && hBucket.read > 0 && (
                <circle cx={cx} cy={yS(hBucket.read)} r="4" fill="var(--app-card)" stroke="#3b82f6" strokeWidth="2" />
              )}
              {hasReplied && hBucket.replied > 0 && (
                <circle cx={cx} cy={yS(hBucket.replied)} r="4" fill="var(--app-card)" stroke="#8b5cf6" strokeWidth="2" />
              )}
              <rect x={ttX} y={ttY} width={ttW} height={ttH}
                rx="6" fill="var(--app-card)" stroke="var(--app-line)" strokeWidth="1" filter="url(#tt-shadow)" />
              <text x={ttX + 10} y={ttY + 13} fontSize="9" fontWeight="600" fill="var(--app-ink-3)">
                {hoverIdx === 0 ? "At send" : `${hoverIdx}h after send`}
              </text>
              <text x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#10b981" fontWeight="500">
                {hBucket.delivered.toLocaleString()} delivered
              </text>
              {hasOpened && (() => { ttLine += 14; return (
                <text key="o" x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#0ea5e9" fontWeight="500">
                  {hBucket.opened.toLocaleString()} opened (may be automatic)
                </text>
              ); })()}
              {hasRead && (() => { ttLine += 14; return (
                <text key="r" x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#3b82f6" fontWeight="500">
                  {hBucket.read.toLocaleString()} read
                </text>
              ); })()}
              {hasReplied && (() => { ttLine += 14; return (
                <text key="p" x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#8b5cf6" fontWeight="500">
                  {hBucket.replied.toLocaleString()} replied
                </text>
              ); })()}
            </g>
          );
        })()}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="h-[2px] w-5 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-ink-2">Delivered</span>
        </div>
        {hasOpened && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-sky-500" />
            <span className="text-[11px] text-ink-2">{OPENED_LABEL}</span>
          </div>
        )}
        {hasRead && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-blue-500" />
            <span className="text-[11px] text-ink-2">Read</span>
          </div>
        )}
        {hasReplied && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-violet-500" />
            <span className="text-[11px] text-ink-2">Replied</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status badge with timestamp tooltip ──────────────────────────────────────

function StatusBadge({ status, tooltip }: { status: RecipientStatus; tooltip?: string }) {
  const m = STATUS_META[status];
  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.bg} ${m.textColor}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );

  if (!tooltip) return badge;

  return (
    <span className="group/sb relative inline-flex">
      {badge}
      <span
        className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 -translate-x-1/2 z-[60] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-medium text-on-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover/sb:opacity-100"
      >
        {tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[3px] border-transparent border-t-ink" />
      </span>
    </span>
  );
}

// ─── Recipient Drawer ─────────────────────────────────────────────────────────

function RecipientDrawer({
  recipient, message, retried, onClose,
}: {
  recipient: CampaignRecipient; message: CampaignMessage; retried: Set<string>; onClose: () => void;
}) {
  const status     = recipientStatus(recipient, retried);
  const person     = recipient.people;
  const chan       = rowChannel(recipient, message);
  const isEmail    = chan === "email";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events: Array<{
    label: string; time: string;
    icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
    color: string; bg: string;
  }> = [
    message.sent_at
      ? { label: "Sent", time: message.sent_at, icon: Send, color: "text-ink-2", bg: "bg-muted" }
      : null,
    recipient.delivered_at
      ? { label: "Delivered", time: recipient.delivered_at, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" }
      : null,
    recipient.opened_at
      ? { label: OPENED_LABEL, time: recipient.opened_at, icon: Eye, color: "text-sky-600", bg: "bg-sky-50" }
      : null,
    recipient.clicked_at
      ? { label: "Clicked a link", time: recipient.clicked_at, icon: MousePointerClick, color: "text-sky-600", bg: "bg-sky-50" }
      : null,
    recipient.read_at
      ? { label: "Read on WhatsApp", time: recipient.read_at, icon: BookOpen, color: "text-blue-600", bg: "bg-blue-50" }
      : null,
    recipient.confirmed_at
      ? { label: "Confirmed they read it", time: recipient.confirmed_at, icon: CheckCheck, color: "text-emerald-700", bg: "bg-emerald-50" }
      : null,
    recipient.replied_at && recipient.status !== "opted_out"
      ? { label: "Replied", time: recipient.replied_at, icon: Reply, color: "text-violet-600", bg: "bg-violet-50" }
      : null,
    recipient.replied_at && recipient.status === "opted_out"
      ? { label: "Opted out (replied STOP)", time: recipient.replied_at, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" }
      : null,
    recipient.bounced_at
      ? { label: `Bounced${recipient.bounce_type ? ` (${recipient.bounce_type})` : ""}`, time: recipient.bounced_at, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" }
      : null,
    recipient.complained_at
      ? { label: "Marked as spam", time: recipient.complained_at, icon: XCircle, color: "text-orange-600", bg: "bg-orange-50" }
      : null,
  ]
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const initials = recipient.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/[0.08] backdrop-blur-[2px] animate-backdrop" onClick={onClose} />
      <div className="animate-slide-right relative flex w-full max-w-[360px] flex-col bg-card border-l border-line shadow-pop overflow-hidden">
        <div className="flex items-center justify-between border-b border-muted-2 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted-2 text-[12px] font-semibold text-ink-2">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">{recipient.name}</p>
              <p className="text-[11px] text-ink-3 font-mono truncate">{recipient.contact_value}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-2 flex-shrink-0 rounded-lg p-1.5 text-ink-3 hover:bg-muted hover:text-ink">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Delivery Status</p>
            <StatusBadge status={status} />
            {status === "opened" && <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{OPENED_EXPLAINER}</p>}
            {status === "retried" && <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{recipient.error_detail ?? "This channel failed, so Kesher tried the next one."}</p>}
          </div>

          <div>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Contact</p>
            <div className="rounded-xl border border-line divide-y divide-muted">
              <div className="px-4 py-3">
                <p className="text-[10px] text-ink-3">Name</p>
                <p className="mt-0.5 text-[13px] text-ink">{recipient.name}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] text-ink-3">{isEmail ? "Email" : chan === "whatsapp" ? "WhatsApp number" : "Phone"}</p>
                <p className="mt-0.5 font-mono text-[12px] text-ink">{recipient.contact_value}</p>
              </div>
              {person?.categories && person.categories.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] text-ink-3">Audiences</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {person.categories.map((c) => (
                      <span key={c} className="rounded-full bg-muted-2 px-2 py-0.5 text-[10px] font-medium text-ink-2">
                        {CATEGORY_LABELS[c] ?? c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Activity Timeline</p>
            {events.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center rounded-xl border border-dashed border-line">
                <Clock size={16} className="text-line-strong" strokeWidth={1.5} />
                <p className="mt-2 text-[12px] text-ink-3">No events recorded yet.</p>
              </div>
            ) : (
              <div>
                {events.map((ev, i) => {
                  const Icon = ev.icon;
                  const isLast = i === events.length - 1;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="relative flex flex-col items-center flex-shrink-0">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full ${ev.bg} ${ev.color}`}>
                          <Icon size={12} strokeWidth={2} />
                        </div>
                        {!isLast && <div className="mt-0.5 h-6 w-px bg-muted-2" />}
                      </div>
                      <div className={isLast ? "pb-0" : "pb-3"}>
                        <p className="text-[13px] font-medium text-ink leading-tight">{ev.label}</p>
                        <p className="mt-0.5 text-[11px] text-ink-3">{fmt(ev.time) ?? ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {status === "bounced" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
              <p className="text-[11px] font-semibold text-amber-700">Bounce Type</p>
              <p className="mt-0.5 text-[13px] capitalize text-amber-600">
                {recipient.bounce_type ? `${recipient.bounce_type} bounce` : "Unknown"}
              </p>
              <p className="mt-1.5 text-[11px] text-amber-500 leading-relaxed">
                {recipient.bounce_type === "hard"
                  ? "This address is invalid or does not accept email. Consider removing it from your list."
                  : "This was a temporary delivery failure. The recipient may receive future messages."}
              </p>
            </div>
          )}
          {status === "failed" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
              <p className="text-[11px] font-semibold text-red-600">Delivery Failed</p>
              <p className="mt-0.5 text-[12px] text-red-500">
                {recipient.error_detail
                  ?? (recipient.bounce_type ? `Error code: ${recipient.bounce_type}` : "The message could not be delivered.")}
              </p>
            </div>
          )}
          {status === "opted_out" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
              <p className="text-[11px] font-semibold text-rose-700">SMS Opt-Out</p>
              <p className="mt-0.5 text-[12px] text-rose-500 leading-relaxed">
                This recipient replied STOP and is opted out of future messages.
              </p>
            </div>
          )}
        </div>

        {person && (
          <div className="border-t border-muted-2 px-5 py-4 flex-shrink-0">
            <Link
              href={`/people/${person.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-canvas px-4 py-2.5 text-[12px] font-medium text-ink-2 hover:bg-card hover:text-ink hover:shadow-sm transition-all duration-150"
            >
              <Users size={12} strokeWidth={2} />
              View full profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter, search, onClear }: {
  filter: FilterKey; search: string; onClear: () => void;
}) {
  const CONFIGS: Record<FilterKey, { title: string; body: string }> = {
    all:        { title: "No recipients yet",     body: "Recipients will appear here once the campaign is sent." },
    delivered:  { title: "No deliveries yet",     body: "Delivery confirmations will appear as messages reach recipients." },
    confirmed:  { title: "Nobody has confirmed yet", body: "People appear here when they tap \"I've read this\" in their message." },
    unseen:     { title: "Everyone has confirmed or read it", body: "Nobody is left who hasn't confirmed or read on WhatsApp." },
    opened:     { title: "No opens recorded",     body: "Email opens are unreliable and may be automatic, so don't treat a missing open as unread." },
    read:       { title: "No read receipts yet",  body: "WhatsApp read receipts appear when recipients open the message." },
    replied:    { title: "No replies yet",        body: "Replies will appear here as recipients respond." },
    failed:     { title: "No failures",           body: "All messages were accepted for delivery." },
  };

  const cfg = search
    ? { title: "No recipients match", body: "Try a different name or contact." }
    : CONFIGS[filter];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-canvas mb-4">
        <Users size={18} className="text-line-strong" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-semibold text-ink">{cfg.title}</p>
      <p className="mt-1 text-[12px] text-ink-3 max-w-xs">{cfg.body}</p>
      {search && (
        <button
          onClick={onClear}
          className="mt-4 rounded-md border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-canvas hover:text-ink transition-all"
        >
          Clear search
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignClient({
  message, recipients, chartData, links,
}: {
  message: CampaignMessage; recipients: CampaignRecipient[]; chartData: ChartBucket[]; links: CampaignLinks;
}) {
  const [filter, setFilter]   = useState<FilterKey>("all");
  const [search, setSearch]   = useState("");
  // Render recipients in pages of 100 so big campaigns don't mount thousands of rows at once
  // (resets whenever the filter or search changes)
  const listKey = `${filter}|${search}`;
  const [shown, setShown] = useState({ key: listKey, count: RECIPIENTS_PAGE });
  const visibleCount = shown.key === listKey ? shown.count : RECIPIENTS_PAGE;
  const [selected, setSelected] = useState<CampaignRecipient | null>(null);

  const channelMeta = CHANNEL_META[message.channel] ?? CHANNEL_META.email;
  const ChannelIcon = channelMeta.icon;
  const sentAt   = message.sent_at ?? message.created_at;
  const usesConfirm = message.confirm_button === "true";

  // A failed row whose message then went out on another channel is "sent another way", not a failure
  const retried = useMemo(() => new Set(recipients.map((r) => r.fallback_of).filter((x): x is string => !!x)), [recipients]);
  const chanOf = useMemo(() => new Map(recipients.map((r) => [r.id, rowChannel(r, message)])), [recipients, message]);

  // Seen = confirmed, or read on WhatsApp. Email opens never count (they may be automatic).
  const seenPeople = useMemo(() => new Set(recipients.filter((r) => r.confirmed_at || r.read_at).map((r) => r.person_id)), [recipients]);

  const stats = useMemo<KPIStats>(() => {
    const email = recipients.filter((r) => chanOf.get(r.id) === "email");
    const wa = recipients.filter((r) => chanOf.get(r.id) === "whatsapp");
    const people = new Set(recipients.map((r) => r.person_id));
    return {
      people:         people.size,
      rows:           recipients.length,
      delivered:      recipients.filter((r) => r.delivered_at).length,
      emailRows:      email.length,
      emailDelivered: email.filter((r) => r.delivered_at).length,
      opened:         email.filter((r) => r.opened_at).length,
      clicked:        email.filter((r) => r.clicked_at).length,
      waRows:         wa.length,
      waDelivered:    wa.filter((r) => r.delivered_at).length,
      read:           wa.filter((r) => r.read_at).length,
      replied:        new Set(recipients.filter((r) => r.replied_at).map((r) => r.person_id)).size,
      confirmed:      new Set(recipients.filter((r) => r.confirmed_at).map((r) => r.person_id)).size,
      seen:           seenPeople.size,
      failed:         recipients.filter((r) => r.status === "failed" && !retried.has(r.id)).length,
      usesConfirm,
    };
  }, [recipients, chanOf, seenPeople, retried, usesConfirm]);

  const FILTERS: { key: FilterKey; label: string; hint?: string }[] = useMemo(() => {
    const list: { key: FilterKey; label: string; hint?: string }[] = [
      { key: "all", label: "All" },
      { key: "delivered", label: "Delivered" },
    ];
    if (usesConfirm || stats.confirmed > 0) list.push({ key: "confirmed", label: "Confirmed" });
    if (usesConfirm || stats.waRows > 0) list.push({ key: "unseen", label: "Not confirmed or read", hint: "Haven't confirmed, and haven't read it on WhatsApp. Email opens aren't used." });
    if (stats.waRows > 0) list.push({ key: "read", label: "Read (WhatsApp)" });
    if (stats.emailRows > 0) list.push({ key: "opened", label: OPENED_LABEL, hint: OPENED_EXPLAINER });
    if (stats.replied > 0) list.push({ key: "replied", label: "Replied" });
    list.push({ key: "failed", label: "Failed" });
    return list;
  }, [usesConfirm, stats.confirmed, stats.waRows, stats.emailRows, stats.replied]);

  const activeFilter: FilterKey = FILTERS.some((f) => f.key === filter) ? filter : "all";

  const matches = useMemo(() => ({
    all:       () => true,
    delivered: (r: CampaignRecipient) => !!r.delivered_at,
    confirmed: (r: CampaignRecipient) => !!r.confirmed_at,
    unseen:    (r: CampaignRecipient) => !seenPeople.has(r.person_id) && r.status !== "opted_out",
    opened:    (r: CampaignRecipient) => !!r.opened_at,
    read:      (r: CampaignRecipient) => !!r.read_at,
    replied:   (r: CampaignRecipient) => !!r.replied_at,
    failed:    (r: CampaignRecipient) => r.status === "failed" && !retried.has(r.id),
  } satisfies Record<FilterKey, (r: CampaignRecipient) => boolean>), [seenPeople, retried]);

  const filterCounts = useMemo(
    () => Object.fromEntries((Object.keys(matches) as FilterKey[]).map((k) => [k, recipients.filter(matches[k]).length])) as Record<FilterKey, number>,
    [recipients, matches]
  );

  const filtered = useMemo(() => {
    let list = recipients.filter(matches[activeFilter]);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.contact_value.toLowerCase().includes(q));
    }
    return list;
  }, [recipients, activeFilter, search, matches]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/messages" className="inline-flex items-center gap-1.5 shrink-0 text-[12px] font-medium text-ink-3 hover:text-ink-2">
              <ArrowLeft size={13} strokeWidth={2} />
              Messages
            </Link>
            <span className="text-ink-5 text-[13px]">/</span>
            <h1 className="truncate text-[13px] font-semibold text-ink">
              {message.subject ?? message.body.slice(0, 55) + (message.body.length > 55 ? "…" : "")}
            </h1>
            <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${channelMeta.bg} ${channelMeta.color}`}>
              <ChannelIcon size={10} strokeWidth={2.5} />
              {channelMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportCSV(recipients, message, retried)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-canvas hover:text-ink hover:border-line-strong"
            >
              <Download size={11} strokeWidth={2} />
              Export
            </button>
            <Link
              href={`/messages/problems?message=${message.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-canvas hover:text-ink hover:border-line-strong"
            >
              <AlertTriangle size={11} strokeWidth={2} />
              Delivery problems
            </Link>
            {message.status !== "sending" && stats.people > 0 && <ResendUnread messageId={message.id} unseenCount={Math.max(0, stats.people - stats.seen)} originalChannels={[...new Set(chanOf.values())]} />}
            <Link
              href={`/messages/new?audiences=${message.audience_slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[12px] font-medium text-on-ink hover:bg-ink-hover"
            >
              <Copy size={11} strokeWidth={2} />
              New message to this audience
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-3 text-[11px] text-ink-3">
          <span>{message.audience_label}</span>
          <span className="text-line">·</span>
          <span>{fmtDate(sentAt)}</span>
          {links.reminderFor && (
            <>
              <span className="text-line">·</span>
              <span>Reminder for <Link href={`/messages/${links.reminderFor.id}`} className="underline decoration-dotted underline-offset-2 hover:text-ink-2">{links.reminderFor.title}</Link></span>
            </>
          )}
          {links.reminders > 0 && (
            <>
              <span className="text-line">·</span>
              <span>{links.reminders} reminder{links.reminders === 1 ? "" : "s"} sent</span>
            </>
          )}
          {message.status === "sent" && (
            <>
              <span className="text-line">·</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Sent
              </span>
            </>
          )}
        </div>
      </header>

      <div className="px-6 py-6 space-y-5 max-w-7xl">
        {/* ── Live progress banner ─────────────────────────────────────────── */}
        <LiveProgressBanner message={message} stats={stats} />

        {/* ── KPI grid ─────────────────────────────────────────────────────── */}
        <KPIGrid stats={stats} />

        {/* ── Timeline + Activity Feed ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Chart — 3/5 width */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-line bg-card shadow-card px-5 py-5 h-full animate-fade-up" style={{ animationDelay: "260ms" }}>
              <div className="mb-5">
                <h2 className="text-[13px] font-semibold text-ink">Delivery Timeline</h2>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  Cumulative events over the first 24 hours · hover for details
                </p>
              </div>
              <TimelineChart data={chartData} />
            </div>
          </div>

          {/* Activity Feed — 2/5 width */}
          <div className="lg:col-span-2">
            <ActivityFeed recipients={recipients} message={message} />
          </div>
        </div>

        {/* ── Recipients table ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-line bg-card shadow-card animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="px-5 pt-5 pb-0">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-[13px] font-semibold text-ink">
                Recipients
                {filtered.length !== recipients.length && (
                  <span className="ml-2 text-[11px] font-normal text-ink-3">
                    {filtered.length.toLocaleString()} of {recipients.length.toLocaleString()}
                  </span>
                )}
              </h2>

              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Search recipients…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 rounded-lg border border-line bg-canvas py-1.5 pl-8 pr-8 text-[12px] text-ink placeholder-line-strong outline-none transition-all focus:border-ink-3 focus:bg-card focus:shadow-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 hover:text-ink"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-0 border-b border-muted-2 -mx-5 px-5">
              {FILTERS.map((f) => {
                const count = filterCounts[f.key];
                const isActive = activeFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    title={f.hint}
                    className={[
                      "inline-flex items-center gap-1.5 border-b-[1.5px] pb-3 pt-0.5 mr-5 text-[12px] font-medium transition-all duration-100",
                      isActive
                        ? "border-ink text-ink"
                        : "border-transparent text-ink-3 hover:text-ink-2",
                    ].join(" ")}
                  >
                    {f.label}
                    {count > 0 && (
                      <span className={`text-[10px] tabular-nums font-normal ${isActive ? "text-ink-2" : "text-line-strong"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState filter={activeFilter} search={search} onClear={() => setSearch("")} />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted-2 bg-canvas">
                  <th className="py-2.5 pl-5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-3">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-3">Via</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-3">Contact</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-3">Status</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-3">Signals</th>
                  <th className="pl-3 pr-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, visibleCount).map((r, i, shown) => {
                  const status = recipientStatus(r, retried);
                  const isLast = i === shown.length - 1;
                  const la = lastActivity(r);
                  const chan = chanOf.get(r.id) ?? "email";
                  const ChanIcon = CHANNEL_META[chan].icon;
                  const tooltipTs = la ? fmt(la) ?? undefined : undefined;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={[
                        "group cursor-pointer transition-colors duration-100 hover:bg-canvas",
                        !isLast ? "border-b border-muted" : "",
                      ].join(" ")}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted-2 text-[10px] font-semibold text-ink-2">
                            {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span dir="auto" className="text-[13px] font-medium text-ink">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHANNEL_META[chan].bg} ${CHANNEL_META[chan].color}`}>
                          <ChanIcon size={10} strokeWidth={2} />
                          {CHANNEL_META[chan].label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-[11px] text-ink-2">{r.contact_value}</span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={status} tooltip={tooltipTs} />
                        {r.error_detail && (
                          <p className={`mt-1 max-w-[260px] break-words text-[11px] leading-snug ${status === "retried" ? "text-ink-3" : "text-red-500"}`}>
                            {r.error_detail}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <span title={r.delivered_at ? `Delivered ${fmt(r.delivered_at)}` : "Not delivered yet"} className={r.delivered_at ? "text-emerald-500" : "text-line-strong"}>
                            <CheckCircle2 size={13} strokeWidth={1.75} />
                          </span>
                          <span title={r.opened_at ? `${OPENED_LABEL} ${fmt(r.opened_at)}` : "No open recorded (not proof it wasn't read)"} className={r.opened_at ? "text-sky-500" : "text-line-strong"}>
                            <Eye size={13} strokeWidth={1.75} />
                          </span>
                          <span title={r.read_at ? `Read on WhatsApp ${fmt(r.read_at)}` : "No WhatsApp read receipt"} className={r.read_at ? "text-blue-500" : "text-line-strong"}>
                            <BookOpen size={13} strokeWidth={1.75} />
                          </span>
                          <span title={r.confirmed_at ? `Confirmed ${fmt(r.confirmed_at)}` : "Not confirmed"} className={r.confirmed_at ? "text-emerald-700" : "text-line-strong"}>
                            <CheckCheck size={14} strokeWidth={2} />
                          </span>
                        </div>
                      </td>
                      <td className="pl-3 pr-5 py-3 text-right">
                        <span className="text-[11px] tabular-nums text-ink-3">
                          {la ? fmt(la, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-muted px-5 py-3">
              <p className="text-[11px] text-ink-3">
                {filtered.length > visibleCount
                  ? `Showing ${visibleCount.toLocaleString()} of ${filtered.length.toLocaleString()} recipients`
                  : `${filtered.length.toLocaleString()} recipient${filtered.length !== 1 ? "s" : ""}`}
                {" · click any row to inspect"}
              </p>
              {filtered.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setShown({ key: listKey, count: visibleCount + RECIPIENTS_PAGE })}
                  className="rounded-md border border-line bg-card px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-ink active:scale-[0.97]"
                >
                  Show more
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <RecipientDrawer
          recipient={selected}
          message={message}
          retried={retried}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
