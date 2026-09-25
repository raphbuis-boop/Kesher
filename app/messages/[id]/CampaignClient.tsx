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
  RotateCcw,
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
} from "lucide-react";
import type { CampaignMessage, CampaignRecipient, ChartBucket } from "./page";
import { useDialogFocus } from "@/app/components/useDialogFocus";

// ─── types ──────────────────────────────────────────────────────────────────

type RecipientStatus =
  | "replied"
  | "read"
  | "opened"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "opted_out"
  | "sent";

type FilterKey = "all" | "delivered" | "opened" | "not_opened" | "read" | "replied" | "failed";

// ─── helpers ────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<
  string,
  { label: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>; color: string; bg: string }
> = {
  email:    { label: "Email",    icon: Mail,          color: "text-text-muted",    bg: "bg-surface-2"   },
  sms:      { label: "SMS",      icon: Smartphone,    color: "text-info",    bg: "bg-info-tint"      },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "text-success", bg: "bg-success-tint"   },
};

const CATEGORY_LABELS: Record<string, string> = {
  parent: "Parent", student: "Student", grandparent: "Grandparent",
  alumni: "Alumni", faculty: "Faculty", staff: "Staff",
  board: "Board", donor: "Donor", prospect: "Prospect",
};

function recipientStatus(r: CampaignRecipient): RecipientStatus {
  if (r.status === "opted_out") return "opted_out";
  if (r.replied_at)          return "replied";
  if (r.complained_at)       return "complained";
  if (r.bounced_at)          return "bounced";
  if (r.status === "failed") return "failed";
  if (r.read_at)             return "read";
  if (r.opened_at)           return "opened";
  if (r.delivered_at)        return "delivered";
  return "sent";
}

const STATUS_META: Record<RecipientStatus, { label: string; textColor: string; bg: string; dot: string }> = {
  replied:   { label: "Replied",   textColor: "text-cat-violet",  bg: "bg-cat-violet-tint",  dot: "bg-cat-violet-solid"  },
  read:      { label: "Read",      textColor: "text-cat-blue",    bg: "bg-cat-blue-tint",    dot: "bg-cat-blue-solid"    },
  opened:    { label: "Opened",    textColor: "text-info",     bg: "bg-info-tint",     dot: "bg-info-solid"     },
  delivered: { label: "Delivered", textColor: "text-success", bg: "bg-success-tint", dot: "bg-success-solid" },
  bounced:   { label: "Bounced",   textColor: "text-warning",   bg: "bg-warning-tint",   dot: "bg-warning-solid"   },
  complained:{ label: "Spam",      textColor: "text-cat-orange",  bg: "bg-cat-orange-tint",  dot: "bg-cat-orange-solid"  },
  failed:    { label: "Failed",    textColor: "text-danger",     bg: "bg-danger-tint",     dot: "bg-danger-solid"     },
  opted_out: { label: "Opted out", textColor: "text-cat-rose",    bg: "bg-cat-rose-tint",    dot: "bg-cat-rose-solid"    },
  sent:      { label: "Sent",      textColor: "text-text-muted",   bg: "bg-surface-2", dot: "bg-text-faint"  },
};

const ACCENT: Record<string, string> = {
  emerald: "border-t-2 border-t-success-solid",
  blue:    "border-t-2 border-t-cat-blue-solid",
  sky:     "border-t-2 border-t-info-solid",
  violet:  "border-t-2 border-t-cat-violet-solid",
  red:     "border-t-2 border-t-danger-solid",
  amber:   "border-t-2 border-t-warning-solid",
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
    [r.replied_at, r.complained_at, r.opened_at, r.read_at, r.bounced_at, r.delivered_at, r.sent_at]
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null
  );
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function exportCSV(recipients: CampaignRecipient[], subject: string | null, channel: string) {
  const isEmail    = channel === "email";
  const isWhatsApp = channel === "whatsapp";

  const header = isEmail
    ? "Name,Email,Status,Delivered At,Opened At,Replied At,Bounced At,Bounce Type"
    : isWhatsApp
    ? "Name,Phone,Status,Delivered At,Read At,Replied At"
    : "Name,Phone,Status,Delivered At,Replied At";

  const rows = recipients
    .map((r) => {
      const base = [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.contact_value}"`,
        recipientStatus(r),
        r.delivered_at ? new Date(r.delivered_at).toISOString() : "",
      ];
      if (isEmail) {
        return [...base,
          r.opened_at   ? new Date(r.opened_at).toISOString()   : "",
          r.replied_at  ? new Date(r.replied_at).toISOString()  : "",
          r.bounced_at  ? new Date(r.bounced_at).toISOString()  : "",
          r.bounce_type ?? "",
        ].join(",");
      }
      if (isWhatsApp) {
        return [...base,
          r.read_at    ? new Date(r.read_at).toISOString()    : "",
          r.replied_at ? new Date(r.replied_at).toISOString() : "",
        ].join(",");
      }
      return [...base,
        r.replied_at ? new Date(r.replied_at).toISOString() : "",
      ].join(",");
    })
    .join("\n");

  const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-${(subject ?? "export").replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── useCountUp hook ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (target === 0) { setVal(0); return; }
    let startTime: number | null = null;
    function step(ts: number) {
      if (startTime === null) startTime = ts;
      const t = Math.min((ts - startTime) / duration, 1);
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
  label, value, sub, accent, index = 0,
}: {
  label: string; value: number; sub?: string; accent?: string; index?: number;
}) {
  const count = useCountUp(value, 650);

  return (
    <div
      className={[
        "rounded-xl border border-border bg-surface px-4 py-4 transition-all duration-200 hover:shadow-sm hover:border-border-strong animate-fade-up",
        accent ?? "",
      ].filter(Boolean).join(" ")}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">{label}</p>
      <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-text-primary">
        {count.toLocaleString()}
      </p>
      {sub && <p className="mt-2 text-[11px] text-text-subtle leading-tight">{sub}</p>}
    </div>
  );
}

// ─── KPI grid ────────────────────────────────────────────────────────────────

type KPIStats = {
  total: number; delivered: number; opened: number;
  read: number; replied: number; failed: number;
};

function KPIGrid({ stats, channel }: { stats: KPIStats; channel: string }) {
  if (channel === "email") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Recipients" value={stats.total} index={0} />
        <KPICard label="Delivered" value={stats.delivered}
          sub={pct(stats.delivered, stats.total) + " delivery rate"} accent={ACCENT.emerald} index={1} />
        <KPICard label="Opened" value={stats.opened}
          sub={pct(stats.opened, stats.delivered) + " open rate"}
          accent={stats.opened > 0 ? ACCENT.sky : undefined} index={2} />
        <KPICard label="Failed" value={stats.failed}
          sub={pct(stats.failed, stats.total) + " failure rate"}
          accent={stats.failed > 0 ? ACCENT.red : undefined} index={3} />
      </div>
    );
  }

  if (channel === "whatsapp") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Recipients" value={stats.total} index={0} />
        <KPICard label="Delivered" value={stats.delivered}
          sub={pct(stats.delivered, stats.total) + " delivery rate"} accent={ACCENT.emerald} index={1} />
        <KPICard label="Read" value={stats.read}
          sub={pct(stats.read, stats.delivered) + " read rate"}
          accent={stats.read > 0 ? ACCENT.blue : undefined} index={2} />
        <KPICard label="Replied" value={stats.replied}
          sub={pct(stats.replied, stats.delivered) + " reply rate"}
          accent={stats.replied > 0 ? ACCENT.violet : undefined} index={3} />
        <KPICard label="Failed" value={stats.failed}
          sub={pct(stats.failed, stats.total) + " failure rate"}
          accent={stats.failed > 0 ? ACCENT.red : undefined} index={4} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KPICard label="Recipients" value={stats.total} index={0} />
      <KPICard label="Delivered" value={stats.delivered}
        sub={pct(stats.delivered, stats.total) + " delivery rate"} accent={ACCENT.emerald} index={1} />
      <KPICard label="Replied" value={stats.replied}
        sub={pct(stats.replied, stats.delivered) + " reply rate"}
        accent={stats.replied > 0 ? ACCENT.violet : undefined} index={2} />
      <KPICard label="Failed" value={stats.failed}
        sub={pct(stats.failed, stats.total) + " failure rate"}
        accent={stats.failed > 0 ? ACCENT.red : undefined} index={3} />
    </div>
  );
}

// ─── Live Progress Banner ─────────────────────────────────────────────────────

function LiveProgressBanner({ message, stats }: { message: CampaignMessage; stats: KPIStats }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const sentAt    = message.sent_at ?? message.created_at;
  const ageMs     = Date.now() - new Date(sentAt).getTime();
  const isFresh   = ageMs < 2 * 60 * 60 * 1000;
  const delivPct  = stats.total > 0 ? stats.delivered / stats.total : 0;
  const isComplete = delivPct >= 0.95 || !isFresh;

  const shouldShow = !dismissed && stats.total > 0 && (message.status === "sending" || isFresh);

  useEffect(() => {
    if (!shouldShow || isComplete) return;
    const id = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(id);
  }, [shouldShow, isComplete, router]);

  if (!shouldShow) return null;

  const barPct  = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;
  const isEmail = message.channel === "email";
  const isWA    = message.channel === "whatsapp";
  const engCount = isEmail ? stats.opened : isWA ? stats.read : stats.replied;
  const engLabel = isEmail ? "opened" : isWA ? "read" : "replied";

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4 animate-fade-up" style={{ animationDelay: "0ms" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {isComplete ? (
            <CheckCircle2 size={14} className="text-success flex-shrink-0" strokeWidth={2} />
          ) : (
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-solid opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success-solid" />
            </span>
          )}
          <span className="text-[13px] font-semibold text-text-primary">
            {isComplete ? "Campaign delivered" : "Sending in progress"}
          </span>
          {!isComplete && (
            <span className="text-[11px] text-text-subtle">· updates every 10s</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] tabular-nums font-medium text-text-primary">{barPct}%</span>
          {isComplete && (
            <button
              onClick={() => setDismissed(true)}
              className="rounded p-0.5 text-text-subtle hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-success-solid transition-all duration-700 ease-out"
          style={{ width: `${barPct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success-solid" />
          <span className="text-[11px] text-text-muted">
            <span className="tabular-nums font-semibold text-text-primary">{stats.delivered.toLocaleString()}</span>
            {" / "}{stats.total.toLocaleString()} delivered
          </span>
        </div>
        {engCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-info-solid" />
            <span className="text-[11px] text-text-muted">
              <span className="tabular-nums font-semibold text-text-primary">{engCount.toLocaleString()}</span>
              {" "}{engLabel}
            </span>
          </div>
        )}
        {stats.failed > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-danger-solid" />
            <span className="text-[11px] text-text-muted">
              <span className="tabular-nums font-semibold text-danger">{stats.failed.toLocaleString()}</span>
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
  channel,
}: {
  recipients: CampaignRecipient[];
  channel: string;
}) {
  const isEmail    = channel === "email";
  const isWhatsApp = channel === "whatsapp";

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
        evs.push({ label: `${name} opted out (replied STOP)`, time: r.replied_at, color: "text-cat-rose", bg: "bg-cat-rose-tint", icon: XCircle });
      } else if (r.replied_at) {
        evs.push({ label: `${name} replied`, time: r.replied_at, color: "text-cat-violet", bg: "bg-cat-violet-tint", icon: Reply });
      }
      if (isEmail && r.opened_at) {
        evs.push({ label: `${name} opened the email`, time: r.opened_at, color: "text-info", bg: "bg-info-tint", icon: Eye });
      }
      if (isWhatsApp && r.read_at) {
        evs.push({ label: `${name} read the message`, time: r.read_at, color: "text-cat-blue", bg: "bg-cat-blue-tint", icon: BookOpen });
      }
      if (r.bounced_at) {
        evs.push({ label: `${name}'s message bounced`, time: r.bounced_at, color: "text-warning", bg: "bg-warning-tint", icon: AlertCircle });
      }
      if (r.complained_at) {
        evs.push({ label: `${name} marked as spam`, time: r.complained_at, color: "text-cat-orange", bg: "bg-cat-orange-tint", icon: XCircle });
      }
    }

    return evs
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 20);
  }, [recipients, isEmail, isWhatsApp]);

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-5 flex flex-col animate-fade-up" style={{ animationDelay: "280ms" }}>
      <div className="mb-4 flex-shrink-0">
        <h2 className="text-[13px] font-semibold text-text-primary">Activity</h2>
        <p className="mt-0.5 text-[11px] text-text-subtle">Most recent engagement events</p>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background mb-3">
            <Activity size={15} className="text-text-faint" strokeWidth={1.5} />
          </div>
          <p className="text-[12px] font-medium text-text-muted">Waiting for activity</p>
          <p className="mt-0.5 text-[11px] text-text-subtle">
            {isEmail
              ? "Opens and bounces will appear here."
              : isWhatsApp
              ? "Read receipts and replies will appear here."
              : "Replies will appear here."}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-border-subtle" style={{ maxHeight: 220 }}>
          {events.map((ev, i) => {
            const Icon = ev.icon;
            return (
              <div key={i} className="flex items-start gap-3 py-2.5 first:pt-0">
                <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${ev.bg}`}>
                  <Icon size={11} strokeWidth={2} className={ev.color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-text-primary leading-snug">{ev.label}</p>
                  <p className="mt-0.5 text-[10px] text-text-subtle">{fmtRelative(ev.time)}</p>
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

function TimelineChart({ data, channel }: { data: ChartBucket[]; channel: string }) {
  // Hook must be called before any early return
  const revealPct = useReveal(1100);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isEmail    = channel === "email";
  const isWhatsApp = channel === "whatsapp";

  const hasDelivered = data.some((b) => b.delivered > 0);
  const hasOpened    = isEmail    && data.some((b) => b.opened  > 0);
  const hasRead      = isWhatsApp && data.some((b) => b.read    > 0);
  const hasReplied   = !isEmail   && data.some((b) => b.replied > 0);

  if (!hasDelivered) {
    return (
      <div className="flex h-[160px] flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background">
          <Clock size={18} className="text-text-faint" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-medium text-text-primary">Awaiting delivery events</p>
          <p className="mt-0.5 text-[12px] text-text-subtle">Events will appear as recipients receive the message.</p>
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
            <stop offset="0%"   stopColor="var(--success-solid)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--success-solid)" stopOpacity="0.01" />
          </linearGradient>
          <clipPath id="chart-reveal">
            <rect x={PAD.left} y={0} width={clipW} height={H} />
          </clipPath>
          <filter id="tt-shadow" x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgb(0 0 0 / 0.07)" />
          </filter>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line className="stroke-border-subtle" key={`grid-${i}-${v}`} x1={PAD.left} x2={W - PAD.right} y1={yS(v)} y2={yS(v)} strokeWidth="1" />
        ))}

        {/* Animated chart paths */}
        <g clipPath="url(#chart-reveal)">
          <path d={areaPath("delivered")} fill="url(#grad-del)" />
          <path className="stroke-success-solid" d={linePath("delivered")} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hasOpened && (
            <path className="stroke-info-solid" d={linePath("opened")} fill="none" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {hasRead && (
            <path className="stroke-cat-blue-solid" d={linePath("read")} fill="none" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {hasReplied && (
            <path className="stroke-cat-violet-solid" d={linePath("replied")} fill="none" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
          )}
        </g>

        {/* Axes */}
        {xTicks.map((i) => (
          <text className="fill-text-subtle" key={i} x={xS(i)} y={H - 8} textAnchor="middle" fontSize="9">
            {i === 0 ? "0h" : i === 23 ? "24h" : `${i}h`}
          </text>
        ))}
        {yTicks.filter((v) => v > 0).map((v, i) => (
          <text className="fill-text-subtle" key={`ytick-${i}-${v}`} x={PAD.left - 7} y={yS(v) + 3} textAnchor="end" fontSize="9">
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
              <line className="stroke-border-strong" x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + iH} strokeWidth="1" strokeDasharray="3,2" />
              <circle className="stroke-success-solid fill-surface" cx={cx} cy={yS(hBucket.delivered)} r="4" strokeWidth="2" />
              {hasOpened && hBucket.opened > 0 && (
                <circle className="stroke-info-solid fill-surface" cx={cx} cy={yS(hBucket.opened)} r="4" strokeWidth="2" />
              )}
              {hasRead && hBucket.read > 0 && (
                <circle className="stroke-cat-blue-solid fill-surface" cx={cx} cy={yS(hBucket.read)} r="4" strokeWidth="2" />
              )}
              {hasReplied && hBucket.replied > 0 && (
                <circle className="stroke-cat-violet-solid fill-surface" cx={cx} cy={yS(hBucket.replied)} r="4" strokeWidth="2" />
              )}
              <rect className="stroke-border fill-surface" x={ttX} y={ttY} width={ttW} height={ttH}
                rx="6" strokeWidth="1" filter="url(#tt-shadow)" />
              <text className="fill-text-subtle" x={ttX + 10} y={ttY + 13} fontSize="9" fontWeight="600">
                {hoverIdx === 0 ? "At send" : `${hoverIdx}h after send`}
              </text>
              <text className="fill-success" x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fontWeight="500">
                {hBucket.delivered.toLocaleString()} delivered
              </text>
              {hasOpened && (() => { ttLine += 14; return (
                <text className="fill-info" key="o" x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fontWeight="500">
                  {hBucket.opened.toLocaleString()} opened
                </text>
              ); })()}
              {hasRead && (() => { ttLine += 14; return (
                <text className="fill-cat-blue" key="r" x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fontWeight="500">
                  {hBucket.read.toLocaleString()} read
                </text>
              ); })()}
              {hasReplied && (() => { ttLine += 14; return (
                <text className="fill-cat-violet" key="p" x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fontWeight="500">
                  {hBucket.replied.toLocaleString()} replied
                </text>
              ); })()}
            </g>
          );
        })()}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-1.5">
          <span className="h-[2px] w-5 rounded-full bg-success-solid" />
          <span className="text-[11px] text-text-muted">Delivered</span>
        </div>
        {hasOpened && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-info-solid" />
            <span className="text-[11px] text-text-muted">Opened</span>
          </div>
        )}
        {hasRead && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-cat-blue-solid" />
            <span className="text-[11px] text-text-muted">Read</span>
          </div>
        )}
        {hasReplied && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-cat-violet-solid" />
            <span className="text-[11px] text-text-muted">Replied</span>
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
        className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 -translate-x-1/2 z-[60] whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-fg opacity-0 shadow-lg transition-opacity duration-150 group-hover/sb:opacity-100"
      >
        {tooltip}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[3px] border-transparent border-t-primary" />
      </span>
    </span>
  );
}

// ─── Recipient Drawer ─────────────────────────────────────────────────────────

function RecipientDrawer({
  recipient, message, onClose,
}: {
  recipient: CampaignRecipient; message: CampaignMessage; onClose: () => void;
}) {
  const status     = recipientStatus(recipient);
  const person     = recipient.people;
  const isEmail    = message.channel === "email";
  const isWhatsApp = message.channel === "whatsapp";

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
      ? { label: "Sent", time: message.sent_at, icon: Send, color: "text-text-muted", bg: "bg-surface-2" }
      : null,
    recipient.delivered_at
      ? { label: "Delivered", time: recipient.delivered_at, icon: CheckCircle2, color: "text-success", bg: "bg-success-tint" }
      : null,
    isEmail && recipient.opened_at
      ? { label: "Opened", time: recipient.opened_at, icon: Eye, color: "text-info", bg: "bg-info-tint" }
      : null,
    isWhatsApp && recipient.read_at
      ? { label: "Read", time: recipient.read_at, icon: BookOpen, color: "text-cat-blue", bg: "bg-cat-blue-tint" }
      : null,
    !isEmail && recipient.replied_at && recipient.status !== "opted_out"
      ? { label: "Replied", time: recipient.replied_at, icon: Reply, color: "text-cat-violet", bg: "bg-cat-violet-tint" }
      : null,
    !isEmail && recipient.replied_at && recipient.status === "opted_out"
      ? { label: "Opted out (replied STOP)", time: recipient.replied_at, icon: XCircle, color: "text-cat-rose", bg: "bg-cat-rose-tint" }
      : null,
    recipient.bounced_at
      ? { label: `Bounced${recipient.bounce_type ? ` (${recipient.bounce_type})` : ""}`, time: recipient.bounced_at, icon: AlertCircle, color: "text-warning", bg: "bg-warning-tint" }
      : null,
    recipient.complained_at
      ? { label: "Marked as spam", time: recipient.complained_at, icon: XCircle, color: "text-cat-orange", bg: "bg-cat-orange-tint" }
      : null,
  ]
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const initials = recipient.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(true, panelRef);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-overlay backdrop-blur-[2px] animate-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipient-drawer-title"
        className="animate-slide-right relative flex w-full max-w-[360px] flex-col bg-surface border-l border-border shadow-2xl shadow-black/10 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-semibold text-text-muted">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 id="recipient-drawer-title" className="text-[13px] font-semibold text-text-primary truncate">{recipient.name}</h2>
              <p className="text-[11px] text-text-subtle font-mono truncate">{recipient.contact_value}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-2 flex-shrink-0 rounded-lg p-1.5 text-text-subtle hover:bg-surface-2 hover:text-text-primary">
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">Delivery Status</p>
            <StatusBadge status={status} />
          </div>

          <div>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">Contact</p>
            <div className="rounded-xl border border-border divide-y divide-border-subtle">
              <div className="px-4 py-3">
                <p className="text-[10px] text-text-subtle">Name</p>
                <p className="mt-0.5 text-[13px] text-text-primary">{recipient.name}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] text-text-subtle">{isEmail ? "Email" : "Phone"}</p>
                <p className="mt-0.5 font-mono text-[12px] text-text-primary">{recipient.contact_value}</p>
              </div>
              {person?.categories && person.categories.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] text-text-subtle">Audiences</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {person.categories.map((c) => (
                      <span key={c} className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-text-muted">
                        {CATEGORY_LABELS[c] ?? c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">Activity Timeline</p>
            {events.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center rounded-xl border border-dashed border-border">
                <Clock size={16} className="text-text-faint" strokeWidth={1.5} />
                <p className="mt-2 text-[12px] text-text-subtle">No events recorded yet.</p>
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
                        {!isLast && <div className="mt-0.5 h-6 w-px bg-surface-3" />}
                      </div>
                      <div className={isLast ? "pb-0" : "pb-3"}>
                        <p className="text-[13px] font-medium text-text-primary leading-tight">{ev.label}</p>
                        <p className="mt-0.5 text-[11px] text-text-subtle">{fmt(ev.time) ?? ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {status === "bounced" && (
            <div className="rounded-xl border border-warning-border bg-warning-tint px-4 py-3.5">
              <p className="text-[11px] font-semibold text-warning">Bounce Type</p>
              <p className="mt-0.5 text-[13px] capitalize text-warning">
                {recipient.bounce_type ? `${recipient.bounce_type} bounce` : "Unknown"}
              </p>
              <p className="mt-1.5 text-[11px] text-warning leading-relaxed">
                {recipient.bounce_type === "hard"
                  ? "This address is invalid or does not accept email. Consider removing it from your list."
                  : "This was a temporary delivery failure. The recipient may receive future messages."}
              </p>
            </div>
          )}
          {status === "failed" && (
            <div className="rounded-xl border border-danger-border bg-danger-tint px-4 py-3.5">
              <p className="text-[11px] font-semibold text-danger">Delivery Failed</p>
              <p className="mt-0.5 text-[12px] text-danger">
                {recipient.bounce_type ? `Error code: ${recipient.bounce_type}` : "The message could not be delivered."}
              </p>
            </div>
          )}
          {status === "opted_out" && (
            <div className="rounded-xl border border-cat-rose-border bg-cat-rose-tint px-4 py-3.5">
              <p className="text-[11px] font-semibold text-cat-rose">SMS Opt-Out</p>
              <p className="mt-0.5 text-[12px] text-cat-rose leading-relaxed">
                This recipient replied STOP and is opted out of future messages.
              </p>
            </div>
          )}
        </div>

        {person && (
          <div className="border-t border-border-subtle px-5 py-4 flex-shrink-0">
            <Link
              href={`/people/${person.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-[12px] font-medium text-text-muted hover:bg-surface hover:text-text-primary hover:shadow-sm transition-all duration-150"
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

function EmptyState({ filter, search, channel, onClear }: {
  filter: FilterKey; search: string; channel: string; onClear: () => void;
}) {
  const CONFIGS: Record<FilterKey, { title: string; body: string }> = {
    all:        { title: "No recipients yet",     body: "Recipients will appear here once the campaign is sent." },
    delivered:  { title: "No deliveries yet",     body: "Delivery confirmations will appear as messages reach recipients." },
    opened:     { title: "No opens yet",          body: channel === "email" ? "Opens will appear once recipients view the email." : "Opens are not tracked for this channel." },
    not_opened: { title: "Everyone has opened",   body: "All delivered recipients have opened the message." },
    read:       { title: "No read receipts yet",  body: "WhatsApp read receipts appear when recipients open the message." },
    replied:    { title: "No replies yet",        body: "Replies will appear here as recipients respond." },
    failed:     { title: "No failures",           body: "All messages were accepted for delivery." },
  };

  const cfg = search
    ? { title: "No recipients match", body: "Try a different name or contact." }
    : CONFIGS[filter];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background mb-4">
        <Users size={18} className="text-text-faint" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-semibold text-text-primary">{cfg.title}</p>
      <p className="mt-1 text-[12px] text-text-subtle max-w-xs">{cfg.body}</p>
      {search && (
        <button
          onClick={onClear}
          className="mt-4 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-muted hover:bg-surface-hover hover:text-text-primary transition-all"
        >
          Clear search
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignClient({
  message, recipients, chartData,
}: {
  message: CampaignMessage; recipients: CampaignRecipient[]; chartData: ChartBucket[];
}) {
  const [filter, setFilter]   = useState<FilterKey>("all");
  const [search, setSearch]   = useState("");
  const [selected, setSelected] = useState<CampaignRecipient | null>(null);

  const channelMeta = CHANNEL_META[message.channel] ?? CHANNEL_META.email;
  const ChannelIcon = channelMeta.icon;
  const sentAt   = message.sent_at ?? message.created_at;
  const isEmail    = message.channel === "email";
  const isWhatsApp = message.channel === "whatsapp";

  const stats = useMemo<KPIStats>(() => ({
    total:     recipients.length,
    delivered: recipients.filter((r) => r.delivered_at).length,
    opened:    recipients.filter((r) => r.opened_at).length,
    read:      recipients.filter((r) => r.read_at).length,
    replied:   recipients.filter((r) => r.replied_at).length,
    failed:    recipients.filter((r) => r.status === "failed").length,
  }), [recipients]);

  const FILTERS: { key: FilterKey; label: string }[] = useMemo(() => {
    if (isEmail) return [
      { key: "all", label: "All" }, { key: "delivered", label: "Delivered" },
      { key: "opened", label: "Opened" }, { key: "not_opened", label: "Not Opened" }, { key: "failed", label: "Failed" },
    ];
    if (isWhatsApp) return [
      { key: "all", label: "All" }, { key: "delivered", label: "Delivered" },
      { key: "read", label: "Read" }, { key: "replied", label: "Replied" }, { key: "failed", label: "Failed" },
    ];
    return [
      { key: "all", label: "All" }, { key: "delivered", label: "Delivered" },
      { key: "replied", label: "Replied" }, { key: "failed", label: "Failed" },
    ];
  }, [isEmail, isWhatsApp]);

  const filterCounts = useMemo(() => ({
    all:        recipients.length,
    delivered:  recipients.filter((r) => r.delivered_at).length,
    opened:     recipients.filter((r) => r.opened_at).length,
    not_opened: recipients.filter((r) => r.delivered_at && !r.opened_at).length,
    read:       recipients.filter((r) => r.read_at).length,
    replied:    recipients.filter((r) => r.replied_at).length,
    failed:     recipients.filter((r) => r.status === "failed").length,
  }), [recipients]);

  const filtered = useMemo(() => {
    let list = recipients;
    switch (filter) {
      case "delivered":  list = list.filter((r) => r.delivered_at); break;
      case "opened":     list = list.filter((r) => r.opened_at); break;
      case "not_opened": list = list.filter((r) => r.delivered_at && !r.opened_at); break;
      case "read":       list = list.filter((r) => r.read_at); break;
      case "replied":    list = list.filter((r) => r.replied_at); break;
      case "failed":     list = list.filter((r) => r.status === "failed"); break;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.contact_value.toLowerCase().includes(q));
    }
    return list;
  }, [recipients, filter, search]);

  useEffect(() => {
    const validKeys = FILTERS.map((f) => f.key);
    if (!validKeys.includes(filter)) setFilter("all");
  }, [FILTERS, filter]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/messages" className="inline-flex items-center gap-1.5 shrink-0 text-[12px] font-medium text-text-subtle hover:text-text-muted">
              <ArrowLeft size={13} strokeWidth={2} />
              Messages
            </Link>
            <span aria-hidden className="text-text-faint text-[13px]">/</span>
            <h1 className="truncate text-[13px] font-semibold text-text-primary">
              {message.subject ?? message.body.slice(0, 55) + (message.body.length > 55 ? "…" : "")}
            </h1>
            <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${channelMeta.bg} ${channelMeta.color}`}>
              <ChannelIcon size={10} strokeWidth={2.5} />
              {channelMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportCSV(recipients, message.subject, message.channel)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
            >
              <Download aria-hidden size={11} strokeWidth={2} />
              Export CSV
            </button>
            <Link
              href={`/messages/new?audiences=${message.audience_slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:bg-primary-hover transition-colors"
            >
              <RotateCcw aria-hidden size={11} strokeWidth={2} />
              Message this audience
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-3 text-[11px] text-text-subtle">
          <span>{message.audience_label}</span>
          <span className="text-text-faint">·</span>
          <span>{fmtDate(sentAt)}</span>
          {message.status === "sent" && (
            <>
              <span className="text-text-faint">·</span>
              <span className="inline-flex items-center gap-1.5 text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success-solid" />
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
        <KPIGrid stats={stats} channel={message.channel} />

        {/* ── Timeline + Activity Feed ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Chart — 3/5 width */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-border bg-surface px-5 py-5 h-full animate-fade-up" style={{ animationDelay: "260ms" }}>
              <div className="mb-5">
                <h2 className="text-[13px] font-semibold text-text-primary">Delivery Timeline</h2>
                <p className="mt-0.5 text-[11px] text-text-subtle">
                  Cumulative events over the first 24 hours · hover for details
                </p>
              </div>
              <TimelineChart data={chartData} channel={message.channel} />
            </div>
          </div>

          {/* Activity Feed — 2/5 width */}
          <div className="lg:col-span-2">
            <ActivityFeed recipients={recipients} channel={message.channel} />
          </div>
        </div>

        {/* ── Recipients table ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-surface animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="px-5 pt-5 pb-0">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-[13px] font-semibold text-text-primary">
                Recipients
                {filtered.length !== recipients.length && (
                  <span className="ml-2 text-[11px] font-normal text-text-subtle">
                    {filtered.length.toLocaleString()} of {recipients.length.toLocaleString()}
                  </span>
                )}
              </h2>

              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" strokeWidth={2} />
                <input
                  aria-label="Search recipients"
                  type="text"
                  placeholder="Search recipients…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 rounded-lg border border-border-input bg-background py-1.5 pl-8 pr-8 text-[12px] text-text-primary placeholder-text-subtle transition-all focus:border-focus-ring focus:bg-surface focus:shadow-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-subtle hover:text-text-primary"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-0 border-b border-border-subtle -mx-5 px-5">
              {FILTERS.map((f) => {
                const count = filterCounts[f.key];
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={[
                      "inline-flex items-center gap-1.5 border-b-[1.5px] pb-3 pt-0.5 mr-5 text-[12px] font-medium transition-all duration-100",
                      isActive
                        ? "border-primary text-text-primary"
                        : "border-transparent text-text-subtle hover:text-text-muted",
                    ].join(" ")}
                  >
                    {f.label}
                    {count > 0 && (
                      <span className={`text-[10px] tabular-nums font-normal ${isActive ? "text-text-muted" : "text-text-subtle"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState filter={filter} search={search} channel={message.channel} onClear={() => setSearch("")} />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-background">
                  <th className="py-2.5 pl-5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                    {isEmail ? "Email" : "Phone"}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Audience</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Status</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Delivered</th>
                  {isEmail && (
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Opened</th>
                  )}
                  {isWhatsApp && (
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Read</th>
                  )}
                  {!isEmail && (
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-text-subtle">Replied</th>
                  )}
                  <th className="pl-3 pr-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const status = recipientStatus(r);
                  const isLast = i === filtered.length - 1;
                  const la = lastActivity(r);
                  const person = r.people;
                  const tooltipTs = la ? fmt(la) ?? undefined : undefined;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={[
                        "group cursor-pointer transition-colors duration-100 hover:bg-surface-hover",
                        !isLast ? "border-b border-border-subtle" : "",
                      ].join(" ")}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-text-muted">
                            {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                            className="text-left text-[13px] font-medium text-text-primary hover:underline underline-offset-2"
                          >
                            {r.name}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-[11px] text-text-muted">{r.contact_value}</span>
                      </td>
                      <td className="px-3 py-3">
                        {person?.categories && person.categories.length > 0 ? (
                          <span className="text-[12px] text-text-muted">
                            {CATEGORY_LABELS[person.categories[0]] ?? person.categories[0]}
                          </span>
                        ) : (
                          <span className="text-text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={status} tooltip={tooltipTs} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.delivered_at ? (
                          <span title={fmt(r.delivered_at) ?? ""} className="inline-flex justify-center cursor-default">
                            <CheckCircle2 aria-hidden size={14} className="text-success" strokeWidth={1.75} /><span className="sr-only">Yes</span>
                          </span>
                        ) : (
                          <span className="text-text-subtle">—</span>
                        )}
                      </td>
                      {isEmail && (
                        <td className="px-3 py-3 text-center">
                          {r.opened_at ? (
                            <span title={fmt(r.opened_at) ?? ""} className="inline-flex justify-center cursor-default">
                              <CheckCircle2 aria-hidden size={14} className="text-info" strokeWidth={1.75} /><span className="sr-only">Yes</span>
                            </span>
                          ) : (
                            <span className="text-text-subtle">—</span>
                          )}
                        </td>
                      )}
                      {isWhatsApp && (
                        <td className="px-3 py-3 text-center">
                          {r.read_at ? (
                            <span title={fmt(r.read_at) ?? ""} className="inline-flex justify-center cursor-default">
                              <CheckCircle2 aria-hidden size={14} className="text-cat-blue" strokeWidth={1.75} /><span className="sr-only">Yes</span>
                            </span>
                          ) : (
                            <span className="text-text-subtle">—</span>
                          )}
                        </td>
                      )}
                      {!isEmail && (
                        <td className="px-3 py-3 text-center">
                          {r.replied_at ? (
                            <span title={fmt(r.replied_at) ?? ""} className="inline-flex justify-center cursor-default">
                              <CheckCircle2 aria-hidden size={14} className="text-cat-violet" strokeWidth={1.75} /><span className="sr-only">Yes</span>
                            </span>
                          ) : (
                            <span className="text-text-subtle">—</span>
                          )}
                        </td>
                      )}
                      <td className="pl-3 pr-5 py-3 text-right">
                        <span className="text-[11px] tabular-nums text-text-subtle">
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
            <div className="border-t border-border-subtle px-5 py-3">
              <p className="text-[11px] text-text-subtle">
                {filtered.length.toLocaleString()} recipient{filtered.length !== 1 ? "s" : ""}
                {" · click any row to inspect"}
              </p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <RecipientDrawer
          recipient={selected}
          message={message}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
