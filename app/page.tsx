export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  Users,
  Send,
  Upload,
  Plus,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  PenLine,
  UserPlus,
  Layers,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRow = {
  id: string;
  subject: string | null;
  body: string;
  channel: string;
  audience_label: string;
  recipient_count: number;
  sent_count: number | null;
  failed_count: number | null;
  status: string;
  sent_at: string | null;
  created_at: string;
};

type ImportRow = {
  id: string;
  file_name: string;
  imported_count: number;
  created_at: string;
};

type RecipRow = {
  message_id: string;
  opened_at: string | null;
  delivered_at: string | null;
};

type PersonRow = { categories: string[] | null };

type FeedItem =
  | {
      kind: "campaign";
      id: string;
      time: string;
      subject: string;
      channel: string;
      audience: string;
      recipients: number;
      sent: number;
      opened: number;
      failed: number;
      status: string;
    }
  | { kind: "import"; id: string; time: string; fileName: string; count: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<
  string,
  {
    label: string;
    Icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>;
    color: string;
    bg: string;
  }
> = {
  email:    { label: "Email",    Icon: Mail,          color: "text-zinc-500",    bg: "bg-[#f5f5f5]"  },
  sms:      { label: "SMS",      Icon: Smartphone,    color: "text-blue-500",    bg: "bg-blue-50"     },
  whatsapp: { label: "WhatsApp", Icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-50"  },
};

const AUDIENCE_LABELS: Record<string, string> = {
  parent: "Parents", student: "Students", grandparent: "Grandparents",
  alumni: "Alumni", faculty: "Faculty", staff: "Staff",
  board: "Board", donor: "Donors", prospect: "Prospects",
};

const QUICK_ACTIONS = [
  { href: "/messages/new", Icon: PenLine,  label: "Compose Message",   sub: "Send to any audience"   },
  { href: "/imports",      Icon: Upload,   label: "Import Contacts",   sub: "Upload a CSV file"      },
  { href: "/people",       Icon: UserPlus, label: "Add Contact",        sub: "Add a single person"    },
  { href: "/audiences",    Icon: Layers,   label: "Manage Audiences",  sub: "View and create groups" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7)  return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function pctStr(num: number, den: number): string | null {
  if (den === 0) return null;
  return ((num / den) * 100).toFixed(1) + "%";
}

function pctNum(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OverviewPage() {
  const supabase = await createSupabaseServerClient();
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const weekAgo  = Date.now() - 7  * 24 * 60 * 60 * 1000;

  // ── Phase 1 (parallel) ──────────────────────────────────────────────────────
  const [
    { count: rawContactCount },
    { data: rawPeople },
    { data: rawMessages },
    { data: rawImports },
  ] = await Promise.all([
    supabase.from("people").select("*", { count: "exact", head: true }),
    supabase.from("people").select("categories"),
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const msgList    = (rawMessages ?? []) as MessageRow[];
  const importList = (rawImports  ?? []) as ImportRow[];
  const peopleList = (rawPeople   ?? []) as PersonRow[];
  const contacts   = rawContactCount ?? 0;

  // ── Phase 2 — recipient stats for known message IDs ──────────────────────────
  const messageIds = msgList.map((m) => m.id);
  const { data: rawRecips } = messageIds.length > 0
    ? await supabase
        .from("message_recipients")
        .select("message_id, opened_at, delivered_at")
        .in("message_id", messageIds)
    : { data: [] };
  const recips = (rawRecips ?? []) as RecipRow[];

  // ── Aggregate recipient stats per message ────────────────────────────────────
  const recipMap = new Map<string, { opened: number; delivered: number }>();
  for (const r of recips) {
    const s = recipMap.get(r.message_id) ?? { opened: 0, delivered: 0 };
    if (r.opened_at)    s.opened++;
    if (r.delivered_at) s.delivered++;
    recipMap.set(r.message_id, s);
  }

  // ── KPI calculations ─────────────────────────────────────────────────────────

  // Campaigns this week
  const weekCount = msgList.filter(
    (m) => new Date(m.sent_at ?? m.created_at).getTime() > weekAgo
  ).length;

  // Delivery rate (last 30 days, from messages table)
  const recentMsgs  = msgList.filter((m) => new Date(m.sent_at ?? m.created_at).getTime() > monthAgo);
  const sumRecip    = recentMsgs.reduce((s, m) => s + (m.recipient_count ?? 0), 0);
  const sumSent     = recentMsgs.reduce((s, m) => s + (m.sent_count ?? 0), 0);
  const delivRate   = pctStr(sumSent, sumRecip);

  // Open rate (email only, from webhook-confirmed recipient data)
  let eDel = 0, eOpen = 0;
  for (const r of recips) {
    const msg = msgList.find((m) => m.id === r.message_id);
    if (msg?.channel === "email") {
      if (r.delivered_at) eDel++;
      if (r.opened_at)    eOpen++;
    }
  }
  const openRate = pctStr(eOpen, eDel);
  const hasOpenData = eDel > 0;

  // ── Audience breakdown ───────────────────────────────────────────────────────
  const catCounts: Record<string, number> = {};
  for (const p of peopleList) {
    for (const c of p.categories ?? []) {
      catCounts[c] = (catCounts[c] ?? 0) + 1;
    }
  }
  const audiences = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const uncategorized =
    contacts - peopleList.filter((p) => p.categories && p.categories.length > 0).length;

  // ── Activity feed ─────────────────────────────────────────────────────────────
  const feed: FeedItem[] = [
    ...msgList.slice(0, 7).map((m): FeedItem => ({
      kind:       "campaign",
      id:         m.id,
      time:       m.sent_at ?? m.created_at,
      subject:    m.subject ?? (m.body.slice(0, 60) + (m.body.length > 60 ? "…" : "")),
      channel:    m.channel,
      audience:   m.audience_label,
      recipients: m.recipient_count ?? 0,
      sent:       m.sent_count ?? 0,
      opened:     recipMap.get(m.id)?.opened ?? 0,
      failed:     m.failed_count ?? 0,
      status:     m.status,
    })),
    ...importList.map((i): FeedItem => ({
      kind:     "import",
      id:       i.id,
      time:     i.created_at,
      fileName: i.file_name,
      count:    i.imported_count,
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 9);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafafa]">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-semibold text-[#0f0f0f]">Overview</h1>
            <p className="text-[11px] text-[#a1a1aa] mt-px">Heichal HaTorah</p>
          </div>
          <Link
            href="/messages/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#27272a]"
          >
            <PenLine size={12} strokeWidth={2} />
            Compose
          </Link>
        </div>
      </header>

      <div className="px-6 py-6 space-y-5 max-w-7xl">

        {/* ── Section 1 — Hero KPIs ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

          {/* Active Contacts */}
          <Link
            href="/people"
            className="group rounded-xl border border-[#e7e7e7] bg-white px-4 py-4 transition-all duration-150 hover:border-[#d4d4d8] hover:shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Active Contacts</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-[#0f0f0f]">
              {contacts.toLocaleString()}
            </p>
            <p className="mt-2 flex items-center justify-between text-[11px] text-[#a1a1aa]">
              <span>in directory</span>
              <ArrowRight size={10} className="text-[#d4d4d8] group-hover:text-[#a1a1aa] transition-colors" />
            </p>
          </Link>

          {/* Campaigns This Week */}
          <Link
            href="/messages"
            className="group rounded-xl border border-[#e7e7e7] bg-white px-4 py-4 transition-all duration-150 hover:border-[#d4d4d8] hover:shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">This Week</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-[#0f0f0f]">
              {weekCount}
            </p>
            <p className="mt-2 flex items-center justify-between text-[11px] text-[#a1a1aa]">
              <span>campaigns sent</span>
              <ArrowRight size={10} className="text-[#d4d4d8] group-hover:text-[#a1a1aa] transition-colors" />
            </p>
          </Link>

          {/* Delivery Rate */}
          <div className="rounded-xl border border-t-2 border-t-emerald-500 border-[#e7e7e7] bg-white px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Delivery Rate</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-[#0f0f0f]">
              {delivRate ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-[#a1a1aa]">last 30 days</p>
          </div>

          {/* Open Rate */}
          <div
            className={[
              "rounded-xl border bg-white px-4 py-4",
              hasOpenData ? "border-t-2 border-t-sky-500 border-[#e7e7e7]" : "border-[#e7e7e7]",
            ].join(" ")}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">Open Rate</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-[#0f0f0f]">
              {openRate ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-[#a1a1aa]">email, last 30d</p>
          </div>
        </div>

        {/* ── Sections 2 + 4 + 5 — Main grid ──────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-5">

          {/* ── Section 2 — Activity Feed (3/5) ──────────────────────────── */}
          <div className="lg:col-span-3 rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
              <div>
                <h2 className="text-[13px] font-semibold text-[#0f0f0f]">Activity</h2>
                <p className="mt-0.5 text-[11px] text-[#a1a1aa]">Campaigns, imports, and contact changes</p>
              </div>
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
              >
                View all <ArrowRight size={10} />
              </Link>
            </div>

            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#e7e7e7] bg-[#fafafa] mb-4">
                  <Send size={17} className="text-[#d4d4d8]" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-semibold text-[#0f0f0f]">No activity yet</p>
                <p className="mt-1 text-[12px] text-[#a1a1aa]">
                  Send your first message to get started.
                </p>
                <Link
                  href="/messages/new"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#e7e7e7] bg-white px-3 py-1.5 text-[12px] font-medium text-[#0f0f0f] hover:bg-[#fafafa] transition-colors"
                >
                  <Plus size={11} strokeWidth={2.5} /> Compose
                </Link>
              </div>
            ) : (
              <div>
                {feed.map((item, i) => {
                  const isLast = i === feed.length - 1;
                  const rowCls = `flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[#fafafa] ${!isLast ? "border-b border-[#f5f5f5]" : ""}`;

                  if (item.kind === "import") {
                    return (
                      <div key={item.id} className={rowCls}>
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                          <Upload size={12} className="text-[#a1a1aa]" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#0f0f0f] leading-snug">
                            <span className="font-medium">Imported {item.count.toLocaleString()} contacts</span>
                            <span className="text-[#71717a]"> · {item.fileName}</span>
                          </p>
                        </div>
                        <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-[#a1a1aa]">
                          {timeAgo(item.time)}
                        </span>
                      </div>
                    );
                  }

                  // Campaign
                  const meta       = CHANNEL_META[item.channel] ?? CHANNEL_META.email;
                  const CIcon      = meta.Icon;
                  const hasFailed  = item.failed > 0;
                  const delivPct   = item.recipients > 0 ? pctNum(item.sent, item.recipients) : null;

                  const iconEl = hasFailed ? (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50">
                      <AlertCircle size={12} className="text-red-400" strokeWidth={2} />
                    </div>
                  ) : item.status === "sent" ? (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                      <CheckCircle2 size={12} className="text-emerald-500" strokeWidth={2} />
                    </div>
                  ) : (
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
                      <CIcon size={12} className={meta.color} strokeWidth={2} />
                    </div>
                  );

                  return (
                    <Link
                      key={item.id}
                      href={`/messages/${item.id}`}
                      className={rowCls + " group"}
                    >
                      {iconEl}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-[13px] font-medium text-[#0f0f0f] truncate leading-snug">
                            {item.subject}
                          </p>
                          <span
                            className={`shrink-0 inline-flex items-center gap-[3px] rounded-full px-1.5 py-px text-[9px] font-semibold ${meta.bg} ${meta.color}`}
                          >
                            <CIcon size={8} strokeWidth={2.5} />
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#a1a1aa] leading-snug">
                          {item.audience}
                          {item.recipients > 0 && (
                            <> · <span className="tabular-nums">{item.recipients.toLocaleString()}</span> recipients</>
                          )}
                          {delivPct !== null && (
                            <> · <span className="text-emerald-600 font-medium">{delivPct}% delivered</span></>
                          )}
                          {item.channel === "email" && item.opened > 0 && (
                            <> · <span className="text-sky-600">{item.opened.toLocaleString()} opened</span></>
                          )}
                          {hasFailed && (
                            <> · <span className="text-red-500">{item.failed} failed</span></>
                          )}
                        </p>
                      </div>
                      <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-[#a1a1aa]">
                        {timeAgo(item.time)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Sidebar (2/5) ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Section 5 — Quick Actions */}
            <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#f0f0f0]">
                <h2 className="text-[13px] font-semibold text-[#0f0f0f]">Quick Actions</h2>
              </div>
              <div className="divide-y divide-[#f5f5f5]">
                {QUICK_ACTIONS.map(({ href, Icon, label, sub }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-[#fafafa]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e7e7e7] bg-white group-hover:border-[#d4d4d8] transition-colors">
                      <Icon size={13} className="text-[#71717a]" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0f0f0f]">{label}</p>
                      <p className="text-[11px] text-[#a1a1aa]">{sub}</p>
                    </div>
                    <ChevronRight
                      size={13}
                      className="text-[#d4d4d8] group-hover:text-[#a1a1aa] shrink-0 transition-colors"
                    />
                  </Link>
                ))}
              </div>
            </div>

            {/* Section 4 — Audience Breakdown / Directory */}
            <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
                <h2 className="text-[13px] font-semibold text-[#0f0f0f]">Directory</h2>
                <Link
                  href="/people"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
                >
                  View all <ArrowRight size={10} />
                </Link>
              </div>

              {audiences.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7e7e7] bg-[#fafafa] mx-auto mb-3">
                    <Users size={14} className="text-[#d4d4d8]" strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] text-[#71717a] font-medium">No contacts yet</p>
                  <Link
                    href="/imports"
                    className="mt-1.5 inline-block text-[11px] text-[#a1a1aa] hover:text-[#71717a] transition-colors"
                  >
                    Import contacts →
                  </Link>
                </div>
              ) : (
                <div className="px-5 py-1">
                  {audiences.map(([cat, count]) => {
                    const share = contacts > 0 ? count / contacts : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3 py-2.5 border-b border-[#f5f5f5] last:border-0">
                        <span className="flex-1 text-[12px] text-[#71717a]">
                          {AUDIENCE_LABELS[cat] ?? cat}
                        </span>
                        <div className="w-16 h-1 rounded-full bg-[#f0f0f0] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#d4d4d8]"
                            style={{ width: `${Math.round(share * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[13px] font-medium tabular-nums text-[#0f0f0f]">
                          {count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                  {uncategorized > 0 && (
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 text-[12px] text-[#a1a1aa]">Uncategorized</span>
                      <div className="w-16 h-1 rounded-full bg-[#f0f0f0] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#e7e7e7]"
                          style={{ width: `${Math.round((uncategorized / contacts) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[13px] font-medium tabular-nums text-[#a1a1aa]">
                        {uncategorized.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 3 — Campaign Performance ─────────────────────────────── */}
        {msgList.length > 0 && (
          <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
              <div>
                <h2 className="text-[13px] font-semibold text-[#0f0f0f]">Campaign Performance</h2>
                <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
                  Last {Math.min(msgList.length, 6)} campaigns
                </p>
              </div>
              <Link
                href="/messages"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
              >
                View all <ArrowRight size={10} />
              </Link>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-5 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Campaign
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Recipients
                  </th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Delivered
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Opened
                  </th>
                  <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Failed
                  </th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Status
                  </th>
                  <th className="pl-3 pr-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody>
                {msgList.slice(0, 6).map((msg, i) => {
                  const isLast     = i === Math.min(msgList.length, 6) - 1;
                  const meta       = CHANNEL_META[msg.channel] ?? CHANNEL_META.email;
                  const CIcon      = meta.Icon;
                  const sent       = msg.sent_count ?? 0;
                  const total      = msg.recipient_count ?? 0;
                  const failed     = msg.failed_count ?? 0;
                  const rs         = recipMap.get(msg.id);
                  const delivPct   = pctNum(sent, total);
                  const openPct    = msg.channel === "email" && rs && rs.delivered > 0
                    ? pctNum(rs.opened, rs.delivered)
                    : null;

                  return (
                    <tr
                      key={msg.id}
                      className={`group transition-colors hover:bg-[#fafafa] ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                    >
                      {/* Campaign */}
                      <td className="py-3.5 pl-5 pr-3">
                        <Link href={`/messages/${msg.id}`} className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-md ${meta.bg}`}
                          >
                            <CIcon size={11} className={meta.color} strokeWidth={1.75} />
                          </span>
                          <span className="text-[13px] font-medium text-[#0f0f0f] truncate max-w-[200px] group-hover:text-[#27272a]">
                            {msg.subject ?? (msg.body.slice(0, 45) + (msg.body.length > 45 ? "…" : ""))}
                          </span>
                        </Link>
                      </td>

                      {/* Recipients */}
                      <td className="px-3 py-3.5 text-right">
                        <span className="text-[12px] tabular-nums text-[#71717a]">
                          {total.toLocaleString()}
                        </span>
                      </td>

                      {/* Delivered (mini progress bar) */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex-1 h-1 rounded-full bg-[#f0f0f0] overflow-hidden"
                            style={{ minWidth: 48 }}
                          >
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${delivPct}%` }}
                            />
                          </div>
                          <span className="shrink-0 w-9 text-right text-[11px] tabular-nums text-[#71717a]">
                            {delivPct}%
                          </span>
                        </div>
                      </td>

                      {/* Opened */}
                      <td className="px-3 py-3.5 text-right">
                        {openPct !== null ? (
                          <span className="text-[12px] tabular-nums text-sky-600 font-medium">
                            {openPct}%
                          </span>
                        ) : (
                          <span className="text-[#d4d4d8]">—</span>
                        )}
                      </td>

                      {/* Failed */}
                      <td className="px-3 py-3.5 text-right">
                        {failed > 0 ? (
                          <span className="text-[12px] tabular-nums text-red-500">{failed}</span>
                        ) : (
                          <span className="text-[#d4d4d8]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5 text-center">
                        {msg.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <span className="h-1 w-1 rounded-full bg-emerald-500" />
                            Sent
                          </span>
                        ) : msg.status === "failed" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                            <span className="h-1 w-1 rounded-full bg-red-500" />
                            Failed
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#a1a1aa]">{msg.status}</span>
                        )}
                      </td>

                      {/* Sent time */}
                      <td className="pl-3 pr-5 py-3.5 text-right">
                        <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                          {timeAgo(msg.sent_at ?? msg.created_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
