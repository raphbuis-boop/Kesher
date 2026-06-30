"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Smartphone,
  MessageSquare,
  Download,
  Copy,
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
} from "lucide-react";
import type { CampaignMessage, CampaignRecipient, ChartBucket } from "./page";

// ─── types ──────────────────────────────────────────────────────────────────

type RecipientStatus =
  | "replied"
  | "read"
  | "opened"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "sent";

// Filter keys vary by channel — we compute them dynamically
type FilterKey = "all" | "delivered" | "opened" | "not_opened" | "read" | "replied" | "failed";

// ─── helpers ────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<
  string,
  { label: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>; color: string; bg: string; }
> = {
  email:    { label: "Email",     icon: Mail,           color: "text-zinc-500",    bg: "bg-[#f5f5f5]"    },
  sms:      { label: "SMS",       icon: Smartphone,     color: "text-blue-500",    bg: "bg-blue-50"       },
  whatsapp: { label: "WhatsApp",  icon: MessageSquare,  color: "text-emerald-500", bg: "bg-emerald-50"    },
};

const CATEGORY_LABELS: Record<string, string> = {
  parent: "Parent", student: "Student", grandparent: "Grandparent",
  alumni: "Alumni", faculty: "Faculty", staff: "Staff",
  board: "Board", donor: "Donor", prospect: "Prospect",
};

// Priority: replied > complained > bounced > failed > read (WA) > opened (email) > delivered > sent
function recipientStatus(r: CampaignRecipient): RecipientStatus {
  if (r.replied_at)        return "replied";
  if (r.complained_at)     return "complained";
  if (r.bounced_at)        return "bounced";
  if (r.status === "failed") return "failed";
  if (r.read_at)           return "read";
  if (r.opened_at)         return "opened";
  if (r.delivered_at)      return "delivered";
  return "sent";
}

const STATUS_META: Record<RecipientStatus, { label: string; textColor: string; bg: string; dot: string }> = {
  replied:   { label: "Replied",   textColor: "text-violet-700",  bg: "bg-violet-50",  dot: "bg-violet-500"  },
  read:      { label: "Read",      textColor: "text-blue-700",    bg: "bg-blue-50",    dot: "bg-blue-500"    },
  opened:    { label: "Opened",    textColor: "text-sky-700",     bg: "bg-sky-50",     dot: "bg-sky-500"     },
  delivered: { label: "Delivered", textColor: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  bounced:   { label: "Bounced",   textColor: "text-amber-700",   bg: "bg-amber-50",   dot: "bg-amber-500"   },
  complained:{ label: "Spam",      textColor: "text-orange-700",  bg: "bg-orange-50",  dot: "bg-orange-500"  },
  failed:    { label: "Failed",    textColor: "text-red-600",     bg: "bg-red-50",     dot: "bg-red-500"     },
  sent:      { label: "Sent",      textColor: "text-[#71717a]",   bg: "bg-[#f5f5f5]", dot: "bg-[#a1a1aa]"  },
};

// Accent top-border classes (full literals for Tailwind scanning)
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
  const isEmail = channel === "email";
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

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
  accent,
  index = 0,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
  index?: number;
}) {
  const count = useCountUp(value, 650);

  return (
    <div
      className={[
        "rounded-xl border border-[#e7e7e7] bg-white px-4 py-4 transition-all duration-200 hover:shadow-sm hover:border-[#d4d4d8] animate-fade-up",
        accent ?? "",
      ].filter(Boolean).join(" ")}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
        {label}
      </p>
      <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-[#0f0f0f]">
        {count.toLocaleString()}
      </p>
      {sub && (
        <p className="mt-2 text-[11px] text-[#a1a1aa] leading-tight">{sub}</p>
      )}
    </div>
  );
}

// ─── KPI grid per channel ─────────────────────────────────────────────────────

type KPIStats = {
  total: number;
  delivered: number;
  opened: number;
  read: number;
  replied: number;
  failed: number;
};

function KPIGrid({ stats, channel }: { stats: KPIStats; channel: string }) {
  // Email: Recipients | Delivered | Opened | Failed
  // Note: Replied is not tracked for email (Resend has no inbound reply webhook)
  if (channel === "email") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard label="Recipients" value={stats.total} index={0} />
        <KPICard
          label="Delivered"
          value={stats.delivered}
          sub={pct(stats.delivered, stats.total) + " delivery rate"}
          accent={ACCENT.emerald}
          index={1}
        />
        <KPICard
          label="Opened"
          value={stats.opened}
          sub={pct(stats.opened, stats.delivered) + " open rate"}
          accent={stats.opened > 0 ? ACCENT.sky : undefined}
          index={2}
        />
        <KPICard
          label="Failed"
          value={stats.failed}
          sub={pct(stats.failed, stats.total) + " failure rate"}
          accent={stats.failed > 0 ? ACCENT.red : undefined}
          index={3}
        />
      </div>
    );
  }

  // WhatsApp: Recipients | Delivered | Read | Replied | Failed
  if (channel === "whatsapp") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Recipients" value={stats.total} index={0} />
        <KPICard
          label="Delivered"
          value={stats.delivered}
          sub={pct(stats.delivered, stats.total) + " delivery rate"}
          accent={ACCENT.emerald}
          index={1}
        />
        <KPICard
          label="Read"
          value={stats.read}
          sub={pct(stats.read, stats.delivered) + " read rate"}
          accent={stats.read > 0 ? ACCENT.blue : undefined}
          index={2}
        />
        <KPICard
          label="Replied"
          value={stats.replied}
          sub={pct(stats.replied, stats.delivered) + " reply rate"}
          accent={stats.replied > 0 ? ACCENT.violet : undefined}
          index={3}
        />
        <KPICard
          label="Failed"
          value={stats.failed}
          sub={pct(stats.failed, stats.total) + " failure rate"}
          accent={stats.failed > 0 ? ACCENT.red : undefined}
          index={4}
        />
      </div>
    );
  }

  // SMS: Recipients | Delivered | Replied | Failed
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KPICard label="Recipients" value={stats.total} index={0} />
      <KPICard
        label="Delivered"
        value={stats.delivered}
        sub={pct(stats.delivered, stats.total) + " delivery rate"}
        accent={ACCENT.emerald}
        index={1}
      />
      <KPICard
        label="Replied"
        value={stats.replied}
        sub={pct(stats.replied, stats.delivered) + " reply rate"}
        accent={stats.replied > 0 ? ACCENT.violet : undefined}
        index={2}
      />
      <KPICard
        label="Failed"
        value={stats.failed}
        sub={pct(stats.failed, stats.total) + " failure rate"}
        accent={stats.failed > 0 ? ACCENT.red : undefined}
        index={3}
      />
    </div>
  );
}

// ─── Timeline chart ───────────────────────────────────────────────────────────

function TimelineChart({ data, channel }: { data: ChartBucket[]; channel: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isEmail    = channel === "email";
  const isWhatsApp = channel === "whatsapp";

  const hasDelivered = data.some((b) => b.delivered > 0);
  const hasOpened    = isEmail && data.some((b) => b.opened > 0);
  const hasRead      = isWhatsApp && data.some((b) => b.read > 0);
  const hasReplied   = !isEmail && data.some((b) => b.replied > 0);

  if (!hasDelivered) {
    return (
      <div className="flex h-[160px] flex-col items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e7e7e7] bg-[#fafafa]">
          <Clock size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-[13px] font-medium text-[#0f0f0f]">Awaiting delivery events</p>
          <p className="mt-0.5 text-[12px] text-[#a1a1aa]">Events will appear here as recipients receive the message.</p>
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
    data
      .map((b, i) => `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)},${yS(b[key] as number).toFixed(1)}`)
      .join(" ");

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
  const ttH = 18 + 14 + (extraLines * 14) + 4;
  const ttW = 120;
  const ttX = hoverIdx !== null
    ? (xS(hoverIdx) > W / 2 ? xS(hoverIdx) - ttW - 10 : xS(hoverIdx) + 10)
    : 0;
  const ttY = PAD.top + 2;

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 160 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="grad-del" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="#10b981" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
          <filter id="tt-shadow" x="-5%" y="-10%" width="110%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000012" />
          </filter>
        </defs>

        {yTicks.map((v) => (
          <line key={v} x1={PAD.left} x2={W - PAD.right} y1={yS(v)} y2={yS(v)}
            stroke="#f0f0f0" strokeWidth="1" />
        ))}

        <path d={areaPath("delivered")} fill="url(#grad-del)" />
        <path d={linePath("delivered")} fill="none"
          stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hasOpened && (
          <path d={linePath("opened")} fill="none"
            stroke="#0ea5e9" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {hasRead && (
          <path d={linePath("read")} fill="none"
            stroke="#3b82f6" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {hasReplied && (
          <path d={linePath("replied")} fill="none"
            stroke="#8b5cf6" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {xTicks.map((i) => (
          <text key={i} x={xS(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#a1a1aa">
            {i === 0 ? "0h" : i === 23 ? "24h" : `${i}h`}
          </text>
        ))}

        {yTicks.filter((v) => v > 0).map((v) => (
          <text key={v} x={PAD.left - 7} y={yS(v) + 3} textAnchor="end" fontSize="9" fill="#a1a1aa">
            {v}
          </text>
        ))}

        <rect
          x={PAD.left} y={PAD.top} width={iW} height={iH}
          fill="transparent"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          style={{ cursor: "crosshair" }}
        />

        {hoverIdx !== null && hBucket && (() => {
          const cx = xS(hoverIdx);
          let ttLine = 27;
          return (
            <g>
              <line x1={cx} y1={PAD.top} x2={cx} y2={PAD.top + iH}
                stroke="#d4d4d8" strokeWidth="1" strokeDasharray="3,2" />
              <circle cx={cx} cy={yS(hBucket.delivered)} r="4"
                fill="white" stroke="#10b981" strokeWidth="2" />
              {hasOpened && hBucket.opened > 0 && (
                <circle cx={cx} cy={yS(hBucket.opened)} r="4"
                  fill="white" stroke="#0ea5e9" strokeWidth="2" />
              )}
              {hasRead && hBucket.read > 0 && (
                <circle cx={cx} cy={yS(hBucket.read)} r="4"
                  fill="white" stroke="#3b82f6" strokeWidth="2" />
              )}
              {hasReplied && hBucket.replied > 0 && (
                <circle cx={cx} cy={yS(hBucket.replied)} r="4"
                  fill="white" stroke="#8b5cf6" strokeWidth="2" />
              )}

              <rect x={ttX} y={ttY} width={ttW} height={ttH}
                rx="6" fill="white" stroke="#e7e7e7" strokeWidth="1"
                filter="url(#tt-shadow)" />
              <text x={ttX + 10} y={ttY + 13} fontSize="9" fontWeight="600" fill="#a1a1aa">
                {hoverIdx === 0 ? "At send" : `${hoverIdx}h after send`}
              </text>
              <text x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#10b981" fontWeight="500">
                {hBucket.delivered.toLocaleString()} delivered
              </text>
              {hasOpened && (() => { ttLine += 14; return (
                <text x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#0ea5e9" fontWeight="500">
                  {hBucket.opened.toLocaleString()} opened
                </text>
              ); })()}
              {hasRead && (() => { ttLine += 14; return (
                <text x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#3b82f6" fontWeight="500">
                  {hBucket.read.toLocaleString()} read
                </text>
              ); })()}
              {hasReplied && (() => { ttLine += 14; return (
                <text x={ttX + 10} y={ttY + ttLine} fontSize="9.5" fill="#8b5cf6" fontWeight="500">
                  {hBucket.replied.toLocaleString()} replied
                </text>
              ); })()}
            </g>
          );
        })()}
      </svg>

      <div className="mt-3 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="h-[2px] w-5 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-[#71717a]">Delivered</span>
        </div>
        {hasOpened && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-sky-500" />
            <span className="text-[11px] text-[#71717a]">Opened</span>
          </div>
        )}
        {hasRead && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-blue-500" />
            <span className="text-[11px] text-[#71717a]">Read</span>
          </div>
        )}
        {hasReplied && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-5 rounded-full bg-violet-500" />
            <span className="text-[11px] text-[#71717a]">Replied</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RecipientStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.bg} ${m.textColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ─── Recipient Drawer ─────────────────────────────────────────────────────────

function RecipientDrawer({
  recipient,
  message,
  onClose,
}: {
  recipient: CampaignRecipient;
  message: CampaignMessage;
  onClose: () => void;
}) {
  const status = recipientStatus(recipient);
  const person = recipient.people;
  const isEmail = message.channel === "email";
  const isWhatsApp = message.channel === "whatsapp";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events: Array<{
    label: string;
    time: string;
    icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
    color: string;
    bg: string;
  }> = [
    message.sent_at
      ? { label: "Sent",           time: message.sent_at,         icon: Send,         color: "text-[#71717a]",   bg: "bg-[#f5f5f5]"   }
      : null,
    recipient.delivered_at
      ? { label: "Delivered",      time: recipient.delivered_at,  icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50"  }
      : null,
    // Email only
    isEmail && recipient.opened_at
      ? { label: "Opened",         time: recipient.opened_at,     icon: Eye,          color: "text-sky-600",     bg: "bg-sky-50"      }
      : null,
    // WhatsApp only
    isWhatsApp && recipient.read_at
      ? { label: "Read",           time: recipient.read_at,       icon: BookOpen,     color: "text-blue-600",    bg: "bg-blue-50"     }
      : null,
    // SMS + WhatsApp
    !isEmail && recipient.replied_at
      ? { label: "Replied",        time: recipient.replied_at,    icon: Reply,        color: "text-violet-600",  bg: "bg-violet-50"   }
      : null,
    recipient.bounced_at
      ? {
          label: `Bounced${recipient.bounce_type ? ` (${recipient.bounce_type})` : ""}`,
          time: recipient.bounced_at,
          icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50",
        }
      : null,
    recipient.complained_at
      ? { label: "Marked as spam", time: recipient.complained_at, icon: XCircle,      color: "text-orange-600",  bg: "bg-orange-50"   }
      : null,
  ]
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const initials = recipient.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/[0.08] backdrop-blur-[2px] animate-backdrop"
        onClick={onClose}
      />
      <div className="animate-slide-right relative flex w-full max-w-[360px] flex-col bg-white border-l border-[#e7e7e7] shadow-2xl shadow-black/10 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[12px] font-semibold text-[#71717a]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#0f0f0f] truncate">{recipient.name}</p>
              <p className="text-[11px] text-[#a1a1aa] font-mono truncate">{recipient.contact_value}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex-shrink-0 rounded-lg p-1.5 text-[#a1a1aa] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Delivery Status
            </p>
            <StatusBadge status={status} />
          </div>

          <div>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Contact
            </p>
            <div className="rounded-xl border border-[#e7e7e7] divide-y divide-[#f5f5f5]">
              <div className="px-4 py-3">
                <p className="text-[10px] text-[#a1a1aa]">Name</p>
                <p className="mt-0.5 text-[13px] text-[#0f0f0f]">{recipient.name}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] text-[#a1a1aa]">
                  {isEmail ? "Email" : "Phone"}
                </p>
                <p className="mt-0.5 font-mono text-[12px] text-[#0f0f0f]">{recipient.contact_value}</p>
              </div>
              {person?.categories && person.categories.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] text-[#a1a1aa]">Audiences</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {person.categories.map((c) => (
                      <span key={c} className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-medium text-[#71717a]">
                        {CATEGORY_LABELS[c] ?? c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Activity Timeline
            </p>
            {events.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center rounded-xl border border-dashed border-[#e7e7e7]">
                <Clock size={16} className="text-[#d4d4d8]" strokeWidth={1.5} />
                <p className="mt-2 text-[12px] text-[#a1a1aa]">No events recorded yet.</p>
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
                        {!isLast && <div className="mt-0.5 h-6 w-px bg-[#f0f0f0]" />}
                      </div>
                      <div className={`${isLast ? "pb-0" : "pb-3"}`}>
                        <p className="text-[13px] font-medium text-[#0f0f0f] leading-tight">{ev.label}</p>
                        <p className="mt-0.5 text-[11px] text-[#a1a1aa]">{fmt(ev.time) ?? ""}</p>
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
                {recipient.bounce_type
                  ? `Error code: ${recipient.bounce_type}`
                  : "The message could not be delivered to this recipient."}
              </p>
            </div>
          )}
        </div>

        {person && (
          <div className="border-t border-[#f0f0f0] px-5 py-4 flex-shrink-0">
            <Link
              href={`/people/${person.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-4 py-2.5 text-[12px] font-medium text-[#71717a] hover:bg-white hover:text-[#0f0f0f] hover:shadow-sm transition-all duration-150"
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

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptyState({ filter, search, channel, onClear }: {
  filter: FilterKey;
  search: string;
  channel: string;
  onClear: () => void;
}) {
  const CONFIGS: Record<FilterKey, { title: string; body: string }> = {
    all:        { title: "No recipients",        body: "Recipients will appear here once the campaign is sent." },
    delivered:  { title: "No deliveries yet",    body: "Delivery events will populate as the message reaches recipients." },
    opened:     { title: "No opens yet",         body: channel === "email" ? "Opens will appear once recipients view the email." : "Opens are not tracked for this channel." },
    not_opened: { title: "Everyone has opened",  body: "All delivered recipients have opened the message." },
    read:       { title: "No read receipts yet", body: "WhatsApp read receipts will appear here when recipients open the message." },
    replied:    { title: "No replies yet",       body: "Replies will appear here as recipients respond." },
    failed:     { title: "No failures",          body: "All messages were accepted for delivery." },
  };

  const cfg = search ? { title: "No recipients match", body: "Try a different name or contact." } : CONFIGS[filter];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e7e7e7] bg-[#fafafa] mb-4">
        <Users size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
      </div>
      <p className="text-[13px] font-semibold text-[#0f0f0f]">{cfg.title}</p>
      <p className="mt-1 text-[12px] text-[#a1a1aa] max-w-xs">{cfg.body}</p>
      {search && (
        <button
          onClick={onClear}
          className="mt-4 rounded-md border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#fafafa] hover:text-[#0f0f0f] transition-all"
        >
          Clear search
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CampaignClient({
  message,
  recipients,
  chartData,
}: {
  message: CampaignMessage;
  recipients: CampaignRecipient[];
  chartData: ChartBucket[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CampaignRecipient | null>(null);

  const channelMeta = CHANNEL_META[message.channel] ?? CHANNEL_META.email;
  const ChannelIcon = channelMeta.icon;
  const sentAt = message.sent_at ?? message.created_at;
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

  // Filter tabs per channel
  const FILTERS: { key: FilterKey; label: string }[] = useMemo(() => {
    if (isEmail) return [
      { key: "all",        label: "All"        },
      { key: "delivered",  label: "Delivered"  },
      { key: "opened",     label: "Opened"     },
      { key: "not_opened", label: "Not Opened" },
      { key: "failed",     label: "Failed"     },
    ];
    if (isWhatsApp) return [
      { key: "all",       label: "All"       },
      { key: "delivered", label: "Delivered" },
      { key: "read",      label: "Read"      },
      { key: "replied",   label: "Replied"   },
      { key: "failed",    label: "Failed"    },
    ];
    // SMS
    return [
      { key: "all",       label: "All"       },
      { key: "delivered", label: "Delivered" },
      { key: "replied",   label: "Replied"   },
      { key: "failed",    label: "Failed"    },
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
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || r.contact_value.toLowerCase().includes(q)
      );
    }
    return list;
  }, [recipients, filter, search]);

  // Reset filter if current tab doesn't exist for this channel
  useEffect(() => {
    const validKeys = FILTERS.map((f) => f.key);
    if (!validKeys.includes(filter)) setFilter("all");
  }, [FILTERS, filter]);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/messages"
              className="inline-flex items-center gap-1.5 shrink-0 text-[12px] font-medium text-[#a1a1aa] hover:text-[#71717a]"
            >
              <ArrowLeft size={13} strokeWidth={2} />
              Messages
            </Link>
            <span className="text-[#e0e0e0] text-[13px]">/</span>
            <h1 className="truncate text-[13px] font-semibold text-[#0f0f0f]">
              {message.subject ?? message.body.slice(0, 55) + (message.body.length > 55 ? "…" : "")}
            </h1>
            <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${channelMeta.bg} ${channelMeta.color}`}>
              <ChannelIcon size={10} strokeWidth={2.5} />
              {channelMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportCSV(recipients, message.subject, message.channel)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#fafafa] hover:text-[#0f0f0f] hover:border-[#d4d4d8]"
            >
              <Download size={11} strokeWidth={2} />
              Export
            </button>
            <Link
              href={`/messages/new?audiences=${message.audience_slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#fafafa] hover:text-[#0f0f0f] hover:border-[#d4d4d8]"
            >
              <RotateCcw size={11} strokeWidth={2} />
              Resend
            </Link>
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#27272a]"
            >
              <Copy size={11} strokeWidth={2} />
              Duplicate
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-3 text-[11px] text-[#a1a1aa]">
          <span>{message.audience_label}</span>
          <span className="text-[#e7e7e7]">·</span>
          <span>{fmtDate(sentAt)}</span>
          {message.status === "sent" && (
            <>
              <span className="text-[#e7e7e7]">·</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Sent
              </span>
            </>
          )}
        </div>
      </header>

      <div className="px-6 py-6 space-y-5 max-w-7xl">
        {/* ── KPI grid ────────────────────────────────────────────────────── */}
        <KPIGrid stats={stats} channel={message.channel} />

        {/* ── Timeline chart ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#e7e7e7] bg-white px-5 py-5 animate-fade-up" style={{ animationDelay: "260ms" }}>
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-[#0f0f0f]">Delivery Timeline</h2>
              <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
                Cumulative events over the first 24 hours · hover for details
              </p>
            </div>
          </div>
          <TimelineChart data={chartData} channel={message.channel} />
        </div>

        {/* ── Recipients table ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#e7e7e7] bg-white animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="px-5 pt-5 pb-0">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-[13px] font-semibold text-[#0f0f0f]">
                Recipients
                {filtered.length !== recipients.length && (
                  <span className="ml-2 text-[11px] font-normal text-[#a1a1aa]">
                    {filtered.length.toLocaleString()} of {recipients.length.toLocaleString()}
                  </span>
                )}
              </h2>

              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Search recipients…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 rounded-lg border border-[#e7e7e7] bg-[#fafafa] py-1.5 pl-8 pr-8 text-[12px] text-[#0f0f0f] placeholder-[#d4d4d8] outline-none transition-all focus:border-[#a1a1aa] focus:bg-white focus:shadow-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#a1a1aa] hover:text-[#0f0f0f]"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-0 border-b border-[#f0f0f0] -mx-5 px-5">
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
                        ? "border-[#0f0f0f] text-[#0f0f0f]"
                        : "border-transparent text-[#a1a1aa] hover:text-[#71717a]",
                    ].join(" ")}
                  >
                    {f.label}
                    {count > 0 && (
                      <span className={`text-[10px] tabular-nums font-normal ${isActive ? "text-[#71717a]" : "text-[#d4d4d8]"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <EmptyState filter={filter} search={search} channel={message.channel} onClear={() => setSearch("")} />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Name</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    {isEmail ? "Email" : "Phone"}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Audience</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Status</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Delivered</th>
                  {isEmail && (
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Opened</th>
                  )}
                  {isWhatsApp && (
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Read</th>
                  )}
                  {!isEmail && (
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">Replied</th>
                  )}
                  <th className="pl-3 pr-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
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

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={[
                        "group cursor-pointer transition-colors duration-100 hover:bg-[#fafafa]",
                        !isLast ? "border-b border-[#f5f5f5]" : "",
                      ].join(" ")}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[10px] font-semibold text-[#71717a]">
                            {r.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span className="text-[13px] font-medium text-[#0f0f0f]">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-[11px] text-[#71717a]">{r.contact_value}</span>
                      </td>
                      <td className="px-3 py-3">
                        {person?.categories && person.categories.length > 0 ? (
                          <span className="text-[12px] text-[#71717a]">
                            {CATEGORY_LABELS[person.categories[0]] ?? person.categories[0]}
                          </span>
                        ) : (
                          <span className="text-[#d4d4d8]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.delivered_at
                          ? <CheckCircle2 size={14} className="mx-auto text-emerald-500" strokeWidth={1.75} />
                          : <span className="text-[#d4d4d8]">—</span>}
                      </td>
                      {isEmail && (
                        <td className="px-3 py-3 text-center">
                          {r.opened_at
                            ? <CheckCircle2 size={14} className="mx-auto text-sky-500" strokeWidth={1.75} />
                            : <span className="text-[#d4d4d8]">—</span>}
                        </td>
                      )}
                      {isWhatsApp && (
                        <td className="px-3 py-3 text-center">
                          {r.read_at
                            ? <CheckCircle2 size={14} className="mx-auto text-blue-500" strokeWidth={1.75} />
                            : <span className="text-[#d4d4d8]">—</span>}
                        </td>
                      )}
                      {!isEmail && (
                        <td className="px-3 py-3 text-center">
                          {r.replied_at
                            ? <CheckCircle2 size={14} className="mx-auto text-violet-500" strokeWidth={1.75} />
                            : <span className="text-[#d4d4d8]">—</span>}
                        </td>
                      )}
                      <td className="pl-3 pr-5 py-3 text-right">
                        <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                          {la
                            ? fmt(la, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                            : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {filtered.length > 0 && (
            <div className="border-t border-[#f5f5f5] px-5 py-3">
              <p className="text-[11px] text-[#a1a1aa]">
                {filtered.length.toLocaleString()} recipient{filtered.length !== 1 ? "s" : ""}
                {filtered.length !== recipients.length && ` · click a row to inspect`}
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
