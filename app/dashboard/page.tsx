export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { getBrandingSettings } from "@/lib/settings";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
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
  email:    { label: "Email",    Icon: Mail,          color: "text-text-muted",    bg: "bg-surface-2"  },
  sms:      { label: "SMS",      Icon: Smartphone,    color: "text-info",    bg: "bg-info-tint"     },
  whatsapp: { label: "WhatsApp", Icon: MessageSquare, color: "text-success", bg: "bg-success-tint"  },
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
  const orgId = await getOrgId();
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const weekAgo  = Date.now() - 7  * 24 * 60 * 60 * 1000;

  // ── Phase 1 (parallel) ──────────────────────────────────────────────────────
  const [
    branding,
    demoLoaded,
    { count: rawContactCount },
    { data: rawPeople },
    { data: rawMessages },
    { data: rawImports },
  ] = await Promise.all([
    getBrandingSettings(),
    isDemoWorkspaceLoaded(supabase, orgId),
    supabase.from("people").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("people").select("categories").eq("org_id", orgId),
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, created_at")
      .eq("org_id", orgId)
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
    <div className="min-h-screen bg-background">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-text-primary">Overview</h1>
            <p className="text-[11px] text-text-subtle mt-px">{branding.schoolName || "Your Organization"}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {demoLoaded && <DemoWorkspaceControl mode="badge" />}
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:bg-primary-hover"
            >
              <PenLine size={12} strokeWidth={2} />
              Compose
            </Link>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6 max-w-7xl">

        {/* ── Load demo workspace (only ever shown when the workspace is empty) ── */}
        {contacts === 0 && !demoLoaded && <DemoWorkspaceControl mode="load" />}

        {/* ── Section 1 — Hero KPIs ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

          {/* Active Contacts */}
          <Link
            href="/people"
            className="group rounded-xl border border-border bg-surface px-4 py-4 transition-all duration-150 hover:border-border-strong hover:shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">Active Contacts</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-text-primary">
              {contacts.toLocaleString()}
            </p>
            <p className="mt-2 flex items-center justify-between text-[11px] text-text-subtle">
              <span>in directory</span>
              <ArrowRight size={10} className="text-text-faint group-hover:text-text-subtle transition-colors" />
            </p>
          </Link>

          {/* Campaigns This Week */}
          <Link
            href="/messages"
            className="group rounded-xl border border-border bg-surface px-4 py-4 transition-all duration-150 hover:border-border-strong hover:shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">This Week</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-text-primary">
              {weekCount}
            </p>
            <p className="mt-2 flex items-center justify-between text-[11px] text-text-subtle">
              <span>campaigns sent</span>
              <ArrowRight size={10} className="text-text-faint group-hover:text-text-subtle transition-colors" />
            </p>
          </Link>

          {/* Delivery Rate */}
          <div className="rounded-xl border border-t-2 border-t-success-solid border-border bg-surface px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">Delivery Rate</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-text-primary">
              {delivRate ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-text-subtle">last 30 days</p>
          </div>

          {/* Open Rate */}
          <div
            className={[
              "rounded-xl border bg-surface px-4 py-4",
              hasOpenData ? "border-t-2 border-t-info-solid border-border" : "border-border",
            ].join(" ")}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">Open Rate</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-text-primary">
              {openRate ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-text-subtle">email, last 30d</p>
          </div>
        </div>

        {/* ── Sections 2 + 4 + 5 — Main grid ──────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-5">

          {/* ── Section 2 — Activity Feed (3/5) ──────────────────────────── */}
          <div className="lg:col-span-3 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
              <div>
                <h2 className="text-[13px] font-semibold text-text-primary">Activity</h2>
                <p className="mt-0.5 text-[11px] text-text-subtle">Campaigns, imports, and contact changes</p>
              </div>
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-text-subtle hover:text-text-muted transition-colors"
              >
                View all <ArrowRight size={10} />
              </Link>
            </div>

            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background mb-4">
                  <Send size={17} className="text-text-faint" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-semibold text-text-primary">No activity yet</p>
                <p className="mt-1 text-[12px] text-text-subtle">
                  Send your first message to get started.
                </p>
                <Link
                  href="/messages/new"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <Plus size={11} strokeWidth={2.5} /> Compose
                </Link>
              </div>
            ) : (
              <div>
                {feed.map((item, i) => {
                  const isLast = i === feed.length - 1;
                  const rowCls = `flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-hover ${!isLast ? "border-b border-border-subtle" : ""}`;

                  if (item.kind === "import") {
                    return (
                      <div key={item.id} className={rowCls}>
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2">
                          <Upload size={12} className="text-text-subtle" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-text-primary leading-snug">
                            <span className="font-medium">Imported {item.count.toLocaleString()} contacts</span>
                            <span className="text-text-muted"> · {item.fileName}</span>
                          </p>
                        </div>
                        <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-text-subtle">
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
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-tint">
                      <AlertCircle size={12} className="text-danger" strokeWidth={2} />
                    </div>
                  ) : item.status === "sent" ? (
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-tint">
                      <CheckCircle2 size={12} className="text-success" strokeWidth={2} />
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
                          <p className="text-[13px] font-medium text-text-primary truncate leading-snug">
                            {item.subject}
                          </p>
                          <span
                            className={`shrink-0 inline-flex items-center gap-[3px] rounded-full px-1.5 py-px text-[9px] font-semibold ${meta.bg} ${meta.color}`}
                          >
                            <CIcon size={8} strokeWidth={2.5} />
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-text-subtle leading-snug">
                          {item.audience}
                          {item.recipients > 0 && (
                            <> · <span className="tabular-nums">{item.recipients.toLocaleString()}</span> recipients</>
                          )}
                          {delivPct !== null && (
                            <> · <span className="text-success font-medium">{delivPct}% delivered</span></>
                          )}
                          {item.channel === "email" && item.opened > 0 && (
                            <> · <span className="text-info">{item.opened.toLocaleString()} opened</span></>
                          )}
                          {hasFailed && (
                            <> · <span className="text-danger">{item.failed} failed</span></>
                          )}
                        </p>
                      </div>
                      <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-text-subtle">
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
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border-subtle">
                <h2 className="text-[13px] font-semibold text-text-primary">Quick Actions</h2>
              </div>
              <div className="divide-y divide-border-subtle">
                {QUICK_ACTIONS.map(({ href, Icon, label, sub }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-surface-hover"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface group-hover:border-border-strong transition-colors">
                      <Icon size={13} className="text-text-muted" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-primary">{label}</p>
                      <p className="text-[11px] text-text-subtle">{sub}</p>
                    </div>
                    <ChevronRight
                      size={13}
                      className="text-text-subtle group-hover:text-text-subtle shrink-0 transition-colors"
                    />
                  </Link>
                ))}
              </div>
            </div>

            {/* Section 4 — Audience Breakdown / Directory */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
                <h2 className="text-[13px] font-semibold text-text-primary">Directory</h2>
                <Link
                  href="/people"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-text-subtle hover:text-text-muted transition-colors"
                >
                  View all <ArrowRight size={10} />
                </Link>
              </div>

              {audiences.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background mx-auto mb-3">
                    <Users size={14} className="text-text-faint" strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] text-text-muted font-medium">No contacts yet</p>
                  <Link
                    href="/imports"
                    className="mt-1.5 inline-block text-[11px] text-text-subtle hover:text-text-muted transition-colors"
                  >
                    Import contacts →
                  </Link>
                </div>
              ) : (
                <div className="px-5 py-1">
                  {audiences.map(([cat, count]) => {
                    const share = contacts > 0 ? count / contacts : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
                        <span className="flex-1 text-[12px] text-text-muted">
                          {AUDIENCE_LABELS[cat] ?? cat}
                        </span>
                        <div className="w-16 h-1 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-border-strong"
                            style={{ width: `${Math.round(share * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[13px] font-medium tabular-nums text-text-primary">
                          {count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                  {uncategorized > 0 && (
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 text-[12px] text-text-subtle">Uncategorized</span>
                      <div className="w-16 h-1 rounded-full bg-surface-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-surface-3"
                          style={{ width: `${Math.round((uncategorized / contacts) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[13px] font-medium tabular-nums text-text-subtle">
                        {uncategorized.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
