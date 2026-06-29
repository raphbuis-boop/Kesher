"use client";

import { useState, useMemo } from "react";
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
  MousePointer,
  Eye,
  Send,
  Clock,
  Users,
} from "lucide-react";
import type { CampaignMessage, CampaignRecipient, ChartBucket } from "./page";

// ─── types ──────────────────────────────────────────────────────────────────

type RecipientStatus =
  | "clicked"
  | "opened"
  | "delivered"
  | "bounced"
  | "complained"
  | "failed"
  | "sent";

type FilterKey =
  | "all"
  | "delivered"
  | "opened"
  | "not_opened"
  | "failed"
  | "bounced";

// ─── helpers ────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<
  string,
  {
    label: string;
    icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
    color: string;
    bg: string;
  }
> = {
  email: { label: "Email", icon: Mail, color: "text-zinc-500", bg: "bg-[#f5f5f5]" },
  sms: { label: "SMS", icon: Smartphone, color: "text-blue-500", bg: "bg-blue-50" },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageSquare,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  parent: "Parent",
  student: "Student",
  grandparent: "Grandparent",
  alumni: "Alumni",
  faculty: "Faculty",
  staff: "Staff",
  board: "Board",
  donor: "Donor",
  prospect: "Prospect",
};

function recipientStatus(r: CampaignRecipient): RecipientStatus {
  if (r.complained_at) return "complained";
  if (r.bounced_at) return "bounced";
  if (r.status === "failed") return "failed";
  if (r.clicked_at) return "clicked";
  if (r.opened_at) return "opened";
  if (r.delivered_at) return "delivered";
  return "sent";
}

const STATUS_META: Record<
  RecipientStatus,
  { label: string; textColor: string; bg: string; dot: string }
> = {
  clicked: {
    label: "Clicked",
    textColor: "text-violet-700",
    bg: "bg-violet-50",
    dot: "bg-violet-500",
  },
  opened: {
    label: "Opened",
    textColor: "text-blue-700",
    bg: "bg-blue-50",
    dot: "bg-blue-500",
  },
  delivered: {
    label: "Delivered",
    textColor: "text-emerald-700",
    bg: "bg-emerald-50",
    dot: "bg-emerald-500",
  },
  bounced: {
    label: "Bounced",
    textColor: "text-amber-700",
    bg: "bg-amber-50",
    dot: "bg-amber-500",
  },
  complained: {
    label: "Spam",
    textColor: "text-orange-700",
    bg: "bg-orange-50",
    dot: "bg-orange-500",
  },
  failed: {
    label: "Failed",
    textColor: "text-red-600",
    bg: "bg-red-50",
    dot: "bg-red-500",
  },
  sent: {
    label: "Sent",
    textColor: "text-[#71717a]",
    bg: "bg-[#f5f5f5]",
    dot: "bg-[#a1a1aa]",
  },
};

function fmt(ts: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!ts) return null;
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  });
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function lastActivity(r: CampaignRecipient): string | null {
  return (
    [r.complained_at, r.clicked_at, r.opened_at, r.bounced_at, r.delivered_at, r.sent_at]
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null
  );
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function exportCSV(recipients: CampaignRecipient[], subject: string | null) {
  const header =
    "Name,Contact,Status,Delivered At,Opened At,Clicked At,Bounced At,Bounce Type";
  const rows = recipients
    .map((r) =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.contact_value}"`,
        recipientStatus(r),
        r.delivered_at ? new Date(r.delivered_at).toISOString() : "",
        r.opened_at ? new Date(r.opened_at).toISOString() : "",
        r.clicked_at ? new Date(r.clicked_at).toISOString() : "",
        r.bounced_at ? new Date(r.bounced_at).toISOString() : "",
        r.bounce_type ?? "",
      ].join(",")
    )
    .join("\n");

  const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-${(subject ?? "export").replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── KPI card ───────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e7e7e7] bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold tracking-tight tabular-nums leading-none text-[#0f0f0f]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && (
        <p className="mt-1.5 text-[11px] tabular-nums text-[#a1a1aa]">{sub}</p>
      )}
    </div>
  );
}

// ─── Timeline chart (pure SVG) ──────────────────────────────────────────────

function TimelineChart({
  data,
  channel,
}: {
  data: ChartBucket[];
  channel: string;
}) {
  const hasDelivered = data.some((b) => b.delivered > 0);
  const hasOpened = data.some((b) => b.opened > 0);
  const hasClicked = data.some((b) => b.clicked > 0);

  if (!hasDelivered) {
    return (
      <div className="flex h-[140px] flex-col items-center justify-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7e7e7] bg-[#fafafa]">
          <Clock size={16} className="text-[#d4d4d8]" strokeWidth={1.5} />
        </div>
        <p className="text-[12px] text-[#a1a1aa]">
          Delivery events will appear here as they arrive.
        </p>
      </div>
    );
  }

  const W = 600,
    H = 140;
  const PAD = { top: 12, right: 16, bottom: 28, left: 40 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.map((b) => b.delivered), 1);
  const xS = (i: number) => PAD.left + (i / (data.length - 1)) * iW;
  const yS = (v: number) => PAD.top + iH - (v / maxVal) * iH;

  const line = (key: keyof ChartBucket) =>
    data
      .map(
        (b, i) =>
          `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)},${yS(b[key] as number).toFixed(1)}`
      )
      .join(" ");

  const area = (key: keyof ChartBucket) => {
    const l = line(key);
    const bx = (PAD.top + iH).toFixed(1);
    return `${l} L${xS(data.length - 1).toFixed(1)},${bx} L${xS(0).toFixed(1)},${bx} Z`;
  };

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const xTicks = [0, 6, 12, 18, 23];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 140 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="cg-del" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map((v) => (
          <line
            key={v}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yS(v)}
            y2={yS(v)}
            stroke="#f0f0f0"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <path d={area("delivered")} fill="url(#cg-del)" />

        {/* Delivered line */}
        <path
          d={line("delivered")}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Opened line (email only) */}
        {channel === "email" && hasOpened && (
          <path
            d={line("opened")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Clicked line (email only) */}
        {channel === "email" && hasClicked && (
          <path
            d={line("clicked")}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* X labels */}
        {xTicks.map((i) => (
          <text
            key={i}
            x={xS(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="9"
            fill="#a1a1aa"
          >
            {i === 0 ? "0h" : i === 23 ? "24h" : `${i}h`}
          </text>
        ))}

        {/* Y labels */}
        {yTicks
          .filter((v) => v > 0)
          .map((v) => (
            <text
              key={v}
              x={PAD.left - 6}
              y={yS(v) + 3}
              textAnchor="end"
              fontSize="9"
              fill="#a1a1aa"
            >
              {v}
            </text>
          ))}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="h-[2px] w-4 rounded-full bg-emerald-500" />
          <span className="text-[11px] text-[#71717a]">Delivered</span>
        </div>
        {channel === "email" && hasOpened && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded-full bg-blue-500" />
            <span className="text-[11px] text-[#71717a]">Opened</span>
          </div>
        )}
        {channel === "email" && hasClicked && (
          <div className="flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded-full bg-violet-500" />
            <span className="text-[11px] text-[#71717a]">Clicked</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recipient drawer ────────────────────────────────────────────────────────

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
  const statusMeta = STATUS_META[status];
  const person = recipient.people;

  const events: Array<{
    label: string;
    time: string;
    icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
    color: string;
  }> = [
    message.sent_at
      ? {
          label: "Sent",
          time: message.sent_at,
          icon: Send,
          color: "text-[#a1a1aa]",
        }
      : null,
    recipient.delivered_at
      ? {
          label: "Delivered",
          time: recipient.delivered_at,
          icon: CheckCircle2,
          color: "text-emerald-500",
        }
      : null,
    recipient.opened_at
      ? { label: "Opened", time: recipient.opened_at, icon: Eye, color: "text-blue-500" }
      : null,
    recipient.clicked_at
      ? {
          label: "Clicked",
          time: recipient.clicked_at,
          icon: MousePointer,
          color: "text-violet-500",
        }
      : null,
    recipient.bounced_at
      ? {
          label: `Bounced${recipient.bounce_type ? ` · ${recipient.bounce_type}` : ""}`,
          time: recipient.bounced_at,
          icon: AlertCircle,
          color: "text-amber-500",
        }
      : null,
    recipient.complained_at
      ? {
          label: "Marked as spam",
          time: recipient.complained_at,
          icon: XCircle,
          color: "text-orange-500",
        }
      : null,
  ]
    .filter(
      (e): e is NonNullable<typeof e> => e !== null
    )
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative flex w-full max-w-sm flex-col bg-white border-l border-[#e7e7e7] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#f0f0f0] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[11px] font-semibold text-[#71717a]">
                {recipient.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#0f0f0f]">
                  {recipient.name}
                </p>
                <p className="text-[11px] text-[#a1a1aa]">{recipient.contact_value}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 rounded-md p-1.5 text-[#a1a1aa] hover:bg-[#f5f5f5] hover:text-[#0f0f0f] transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Status */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Delivery Status
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${statusMeta.bg} ${statusMeta.textColor}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`}
              />
              {statusMeta.label}
            </span>
          </div>

          {/* Contact Info */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Contact
            </p>
            <div className="space-y-2 rounded-xl border border-[#e7e7e7] bg-[#fafafa] p-3.5">
              <div>
                <p className="text-[10px] text-[#a1a1aa]">Name</p>
                <p className="text-[13px] text-[#0f0f0f]">{recipient.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#a1a1aa]">
                  {message.channel === "email" ? "Email" : "Phone"}
                </p>
                <p className="font-mono text-[12px] text-[#0f0f0f]">
                  {recipient.contact_value}
                </p>
              </div>
              {person?.categories && person.categories.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#a1a1aa]">Audiences</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {person.categories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-medium text-[#71717a]"
                      >
                        {CATEGORY_LABELS[c] ?? c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Event Timeline */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Activity
            </p>
            {events.length === 0 ? (
              <p className="text-[12px] text-[#a1a1aa]">No events recorded yet.</p>
            ) : (
              <div className="relative space-y-0">
                {events.map((ev, i) => {
                  const Icon = ev.icon;
                  const isLast = i === events.length - 1;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[#e7e7e7] bg-white ${ev.color}`}
                        >
                          <Icon size={11} strokeWidth={2} />
                        </div>
                        {!isLast && (
                          <div className="h-6 w-px bg-[#f0f0f0]" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="text-[13px] font-medium text-[#0f0f0f]">
                          {ev.label}
                        </p>
                        <p className="text-[11px] text-[#a1a1aa]">
                          {fmt(ev.time) ?? ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Failure reason */}
          {status === "bounced" && recipient.bounce_type && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold text-amber-700">
                Bounce Type
              </p>
              <p className="mt-0.5 text-[12px] capitalize text-amber-600">
                {recipient.bounce_type} bounce
              </p>
            </div>
          )}
          {status === "failed" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
              <p className="text-[11px] font-semibold text-red-600">
                Delivery Failed
              </p>
              <p className="mt-0.5 text-[12px] text-red-500">
                The message could not be delivered to this address.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {person && (
          <div className="border-t border-[#f0f0f0] px-5 py-4">
            <Link
              href={`/people/${person.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e7e7e7] bg-[#fafafa] px-4 py-2.5 text-[12px] font-medium text-[#71717a] transition-colors hover:bg-white hover:text-[#0f0f0f]"
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

// ─── Main component ──────────────────────────────────────────────────────────

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

  // ── KPIs ──
  const kpis = useMemo(() => {
    const total = recipients.length;
    const delivered = recipients.filter((r) => r.delivered_at).length;
    const opened = recipients.filter((r) => r.opened_at).length;
    const clicked = recipients.filter((r) => r.clicked_at).length;
    const failed = recipients.filter((r) => r.status === "failed").length;
    const bounced = recipients.filter((r) => r.bounced_at).length;
    const complained = recipients.filter((r) => r.complained_at).length;
    return { total, delivered, opened, clicked, failed, bounced, complained };
  }, [recipients]);

  // ── Filter counts ──
  const filterCounts = useMemo(
    () => ({
      all: recipients.length,
      delivered: recipients.filter((r) => r.delivered_at).length,
      opened: recipients.filter((r) => r.opened_at).length,
      not_opened: recipients.filter((r) => r.delivered_at && !r.opened_at).length,
      failed: recipients.filter((r) => r.status === "failed").length,
      bounced: recipients.filter((r) => r.bounced_at).length,
    }),
    [recipients]
  );

  // ── Filtered + searched list ──
  const filtered = useMemo(() => {
    let list = recipients;
    switch (filter) {
      case "delivered":
        list = list.filter((r) => r.delivered_at);
        break;
      case "opened":
        list = list.filter((r) => r.opened_at);
        break;
      case "not_opened":
        list = list.filter((r) => r.delivered_at && !r.opened_at);
        break;
      case "failed":
        list = list.filter((r) => r.status === "failed");
        break;
      case "bounced":
        list = list.filter((r) => r.bounced_at);
        break;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.contact_value.toLowerCase().includes(q)
      );
    }
    return list;
  }, [recipients, filter, search]);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "delivered", label: "Delivered" },
    { key: "opened", label: "Opened" },
    { key: "not_opened", label: "Not Opened" },
    { key: "failed", label: "Failed" },
    { key: "bounced", label: "Bounced" },
  ];

  const isEmailChannel = message.channel === "email";

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/messages"
              className="inline-flex items-center gap-1.5 shrink-0 text-[12px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
            >
              <ArrowLeft size={13} strokeWidth={2} />
              Messages
            </Link>
            <span className="text-[#e7e7e7]">/</span>
            <h1 className="truncate text-[13px] font-semibold text-[#0f0f0f]">
              {message.subject ??
                message.body.slice(0, 55) +
                  (message.body.length > 55 ? "…" : "")}
            </h1>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${channelMeta.bg} ${channelMeta.color}`}
            >
              <ChannelIcon size={10} strokeWidth={2} />
              {channelMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportCSV(recipients, message.subject)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#fafafa] hover:text-[#0f0f0f] transition-colors"
            >
              <Download size={11} strokeWidth={2} />
              Export CSV
            </button>
            <Link
              href={`/messages/new?audiences=${message.audience_slug}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#71717a] hover:bg-[#fafafa] hover:text-[#0f0f0f] transition-colors"
            >
              <RotateCcw size={11} strokeWidth={2} />
              Resend
            </Link>
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#27272a] transition-colors"
            >
              <Copy size={11} strokeWidth={2} />
              Duplicate
            </Link>
          </div>
        </div>

        {/* Subtitle row */}
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[#a1a1aa]">
          <span>{message.audience_label}</span>
          <span className="text-[#e7e7e7]">·</span>
          <span>{fmtDate(sentAt)}</span>
          {message.status === "sent" && (
            <>
              <span className="text-[#e7e7e7]">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Sent
              </span>
            </>
          )}
        </div>
      </header>

      <div className="px-6 py-6 space-y-6 max-w-7xl">
        {/* ── KPI grid ── */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <KPICard
            label="Recipients"
            value={kpis.total}
            sub={`${message.recipient_count.toLocaleString()} targeted`}
          />
          <KPICard
            label="Delivered"
            value={kpis.delivered}
            sub={pct(kpis.delivered, kpis.total) + " delivery rate"}
          />
          {isEmailChannel ? (
            <>
              <KPICard
                label="Opened"
                value={kpis.opened}
                sub={pct(kpis.opened, kpis.delivered) + " open rate"}
              />
              <KPICard
                label="Clicked"
                value={kpis.clicked}
                sub={pct(kpis.clicked, kpis.opened) + " click rate"}
              />
            </>
          ) : (
            <>
              <KPICard label="Opened" value="—" sub="Not tracked for SMS" />
              <KPICard label="Clicked" value="—" sub="Not tracked for SMS" />
            </>
          )}
          <KPICard
            label="Failed"
            value={kpis.failed}
            sub={pct(kpis.failed, kpis.total) + " failure rate"}
          />
          <KPICard
            label="Bounced"
            value={kpis.bounced}
            sub={
              kpis.bounced > 0
                ? `${kpis.complained > 0 ? `${kpis.complained} spam` : "0 spam"}`
                : "No bounces"
            }
          />
        </div>

        {/* ── Timeline chart ── */}
        <div className="rounded-xl border border-[#e7e7e7] bg-white px-5 py-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-[#0f0f0f]">
                Delivery Timeline
              </h2>
              <p className="text-[11px] text-[#a1a1aa] mt-0.5">
                Cumulative events over the first 24 hours
              </p>
            </div>
          </div>
          <TimelineChart data={chartData} channel={message.channel} />
        </div>

        {/* ── Recipient table ── */}
        <div className="rounded-xl border border-[#e7e7e7] bg-white">
          {/* Table header */}
          <div className="border-b border-[#f0f0f0] px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[13px] font-semibold text-[#0f0f0f]">
                Recipients
              </h2>
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]"
                  strokeWidth={2}
                />
                <input
                  type="text"
                  placeholder="Search recipients…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-56 rounded-lg border border-[#e7e7e7] bg-[#fafafa] py-1.5 pl-8 pr-3 text-[12px] text-[#0f0f0f] placeholder-[#d4d4d8] outline-none transition-all focus:border-[#a1a1aa] focus:bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#0f0f0f]"
                  >
                    <X size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter tabs */}
            <div className="mt-3 flex items-center gap-0 border-b border-transparent -mb-px">
              {FILTERS.map((f) => {
                const count = filterCounts[f.key];
                const isActive = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={[
                      "inline-flex items-center gap-1.5 border-b-[1.5px] px-1 mr-5 pb-3 pt-0 text-[12px] font-medium transition-all duration-100",
                      isActive
                        ? "border-[#0f0f0f] text-[#0f0f0f]"
                        : "border-transparent text-[#a1a1aa] hover:text-[#71717a]",
                    ].join(" ")}
                  >
                    {f.label}
                    {count > 0 && (
                      <span
                        className={`tabular-nums text-[10px] ${isActive ? "text-[#71717a]" : "text-[#d4d4d8]"}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table body */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7e7e7] bg-[#fafafa] mb-3">
                <Users size={16} className="text-[#d4d4d8]" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-[#0f0f0f]">
                {search ? "No recipients match your search" : emptyStateLabel(filter)}
              </p>
              <p className="mt-1 text-[12px] text-[#a1a1aa]">
                {search
                  ? "Try a different name or email address."
                  : emptyStateSub(filter, message.channel)}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-3 text-[12px] text-[#a1a1aa] underline hover:text-[#71717a]"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                    {message.channel === "email" ? "Email" : "Phone"}
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                    Audience
                  </th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                    Delivered
                  </th>
                  {isEmailChannel && (
                    <>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                        Opened
                      </th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                        Clicked
                      </th>
                    </>
                  )}
                  <th className="pl-3 pr-5 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">
                    Last Activity
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const status = recipientStatus(r);
                  const meta = STATUS_META[status];
                  const isLast = i === filtered.length - 1;
                  const la = lastActivity(r);
                  const person = r.people;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`group cursor-pointer hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[10px] font-semibold text-[#71717a]">
                            {r.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <span className="text-[13px] font-medium text-[#0f0f0f] group-hover:text-[#27272a]">
                            {r.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-[11px] text-[#71717a]">
                          {r.contact_value}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {person?.categories && person.categories.length > 0 ? (
                          <span className="text-[12px] text-[#71717a]">
                            {CATEGORY_LABELS[person.categories[0]] ??
                              person.categories[0]}
                          </span>
                        ) : (
                          <span className="text-[#d4d4d8]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.textColor}`}
                        >
                          <span
                            className={`h-1 w-1 rounded-full ${meta.dot}`}
                          />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {r.delivered_at ? (
                          <CheckCircle2
                            size={14}
                            className="mx-auto text-emerald-500"
                            strokeWidth={1.75}
                          />
                        ) : (
                          <span className="text-[#d4d4d8]">—</span>
                        )}
                      </td>
                      {isEmailChannel && (
                        <>
                          <td className="px-3 py-3 text-center">
                            {r.opened_at ? (
                              <CheckCircle2
                                size={14}
                                className="mx-auto text-blue-500"
                                strokeWidth={1.75}
                              />
                            ) : (
                              <span className="text-[#d4d4d8]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {r.clicked_at ? (
                              <CheckCircle2
                                size={14}
                                className="mx-auto text-violet-500"
                                strokeWidth={1.75}
                              />
                            ) : (
                              <span className="text-[#d4d4d8]">—</span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="pl-3 pr-5 py-3 text-right">
                        <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                          {la ? fmt(la, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Table footer */}
          {filtered.length > 0 && (
            <div className="border-t border-[#f5f5f5] px-5 py-3">
              <p className="text-[11px] text-[#a1a1aa]">
                {filtered.length === recipients.length
                  ? `${recipients.length.toLocaleString()} recipients`
                  : `${filtered.length.toLocaleString()} of ${recipients.length.toLocaleString()} recipients`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recipient detail drawer ── */}
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

function emptyStateLabel(filter: FilterKey): string {
  switch (filter) {
    case "delivered":
      return "No delivered recipients";
    case "opened":
      return "No opens yet";
    case "not_opened":
      return "Everyone opened";
    case "failed":
      return "No failures";
    case "bounced":
      return "No bounces";
    default:
      return "No recipients";
  }
}

function emptyStateSub(filter: FilterKey, channel: string): string {
  switch (filter) {
    case "opened":
      return channel === "email"
        ? "Opens will appear here once recipients view the email."
        : "Opens are not tracked for this channel.";
    case "not_opened":
      return "All delivered recipients have opened the message.";
    case "failed":
      return "All messages were accepted for delivery.";
    case "bounced":
      return "No emails bounced for this campaign.";
    default:
      return "";
  }
}
