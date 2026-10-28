export const dynamic = "force-dynamic";

import Link from "next/link";
import { CONFIRMED_EXPLAINER, OPENED_EXPLAINER } from "@/lib/tracking";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { currentAndNext, getShabbosSettings, getUpcomingWindows } from "@/lib/shabbos";
import { formatInZone, getSchoolTimezone } from "@/lib/schoolTime";
import { getBrandingSettings } from "@/lib/settings";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { getCategoryCounts } from "@/lib/categoryCounts";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { AdminOnly } from "@/app/components/AdminOnly";
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
  confirm_button: string | null;
};

type ImportRow = {
  id: string;
  file_name: string;
  imported_count: number;
  created_at: string;
};

type RecipRow = {
  message_id: string;
  person_id: string;
  channel: string | null;
  opened_at: string | null;
  delivered_at: string | null;
  confirmed_at: string | null;
  read_at: string | null;
};

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
  email:    { label: "Email",    Icon: Mail,          color: "text-ink-2",    bg: "bg-muted"  },
  sms:      { label: "SMS",      Icon: Smartphone,    color: "text-blue-500",    bg: "bg-blue-50"     },
  whatsapp: { label: "WhatsApp", Icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-50"  },
  multi:    { label: "Multi",    Icon: Send,          color: "text-ink-2",       bg: "bg-muted"       },
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
  const { orgId, role } = await getMembership();
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const weekAgo  = Date.now() - 7  * 24 * 60 * 60 * 1000;

  // ── Phase 1 (parallel) ──────────────────────────────────────────────────────
  const [
    branding,
    demoLoaded,
    categoryCounts,
    { data: rawMessages },
    { data: rawImports },
    pendingApproval,
    shabbosSettings,
    shabbosTimezone,
  ] = await Promise.all([
    getBrandingSettings(),
    isDemoWorkspaceLoaded(supabase, orgId),
    getCategoryCounts(supabase, orgId),
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at, confirm_button:payload->>confirmButton")
      .eq("org_id", orgId)
      .in("status", ["sending", "sent", "failed"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    isAdminRole(role)
      ? supabase.from("messages").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending_approval")
      : Promise.resolve({ count: 0 }),
    getShabbosSettings(supabase, orgId),
    getSchoolTimezone(supabase, orgId),
  ]);
  const shabbosWindows = shabbosSettings?.enabled ? await getUpcomingWindows(supabase, orgId, new Date(), 2) : [];
  const { current: nowWindow, next: nextWindow } = currentAndNext(shabbosWindows, shabbosSettings?.bufferMinutes ?? 0);

  const msgList    = (rawMessages ?? []) as MessageRow[];
  const importList = (rawImports  ?? []) as ImportRow[];
  const contacts   = categoryCounts.total;

  // ── Phase 2 — recipient stats for known message IDs ──────────────────────────
  const messageIds = msgList.map((m) => m.id);
  const { data: rawRecips } = messageIds.length > 0
    ? await supabase
        .from("message_recipients")
        .select("message_id, person_id, channel, opened_at, delivered_at, confirmed_at, read_at")
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

  // Opened (email rows only; opens can be automatic, so this is a rough signal) and the honest one:
  // confirmed ("I've read this") or read on WhatsApp, out of people who could have shown either.
  const recentIds = new Set(recentMsgs.map((m) => m.id));
  const confirmLinkIds = new Set(recentMsgs.filter((m) => m.confirm_button === "true").map((m) => m.id));
  let eDel = 0, eOpen = 0;
  const seenPossible = new Set<string>();
  const seenDone = new Set<string>();
  for (const r of recips) {
    if (!recentIds.has(r.message_id)) continue;
    const msg = msgList.find((m) => m.id === r.message_id);
    const channel = r.channel ?? msg?.channel;
    if (channel === "email") {
      if (r.delivered_at) eDel++;
      if (r.opened_at)    eOpen++;
    }
    if ((channel === "whatsapp" && r.delivered_at) || confirmLinkIds.has(r.message_id)) {
      const key = `${r.message_id}:${r.person_id}`;
      seenPossible.add(key);
      if (r.confirmed_at || r.read_at) seenDone.add(key);
    }
  }
  const openRate = pctStr(eOpen, eDel);
  const hasOpenData = eDel > 0;
  const seenRate = pctStr(seenDone.size, seenPossible.size);

  // ── Audience breakdown ───────────────────────────────────────────────────────
  const audiences = Object.entries(categoryCounts.byCategory)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const uncategorized = categoryCounts.uncategorized;

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
    <div className="min-h-screen bg-canvas">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-ink">Overview</h1>
            <p className="text-[11px] text-ink-3 mt-px">{branding.schoolName || "Your Organization"}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {demoLoaded && <AdminOnly><DemoWorkspaceControl mode="remove" /></AdminOnly>}
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-on-ink hover:bg-ink-hover"
            >
              <PenLine size={12} strokeWidth={2} />
              Compose
            </Link>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6 max-w-7xl">

        {shabbosSettings?.enabled && (nowWindow || nextWindow) && (
          <div className={"flex items-center justify-between rounded-xl border px-4 py-3 text-[13px] " + (nowWindow ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-card text-ink-2")}>
            {nowWindow ? (
              <span>
                <span className="font-semibold">{nowWindow.kind === "yomtov" ? (nowWindow.label ?? "Yom Tov") : "Shabbos"}.</span> Sending is paused until{" "}
                {formatInZone(new Date(new Date(nowWindow.endsAt).getTime() + shabbosSettings.bufferMinutes * 60_000), shabbosTimezone)}.
              </span>
            ) : nextWindow ? (
              <span>
                <span className="font-semibold text-ink">{nextWindow.kind === "yomtov" ? `Next: ${nextWindow.label ?? "Yom Tov"}` : "Next Shabbos"}:</span> candle lighting {formatInZone(nextWindow.startsAt, shabbosTimezone)}. Sending pauses then.
              </span>
            ) : null}
            <Link href="/settings#shabbos" className="shrink-0 text-[11px] font-medium text-ink-3 hover:text-ink-2">Settings</Link>
          </div>
        )}

        {(pendingApproval.count ?? 0) > 0 && (
          <Link href="/messages?tab=approval" className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 hover:bg-amber-100">
            <span>
              <span className="font-semibold">{pendingApproval.count}</span> message{pendingApproval.count === 1 ? " is" : "s are"} waiting for your approval
            </span>
            <ArrowRight size={13} />
          </Link>
        )}

        {/* ── Load demo workspace (only ever shown when the workspace is empty) ── */}
        {contacts === 0 && !demoLoaded && <AdminOnly><DemoWorkspaceControl mode="load" /></AdminOnly>}

        {/* ── Section 1 — Hero KPIs ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">

          {/* Active Contacts */}
          <Link
            href="/people"
            className="group rounded-xl border border-line bg-card px-4 py-4 transition-all duration-150 hover:border-line-strong hover:shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Active Contacts</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-ink">
              {contacts.toLocaleString()}
            </p>
            <p className="mt-2 flex items-center justify-between text-[11px] text-ink-3">
              <span>in directory</span>
              <ArrowRight size={10} className="text-line-strong group-hover:text-ink-3 transition-colors" />
            </p>
          </Link>

          {/* Campaigns This Week */}
          <Link
            href="/messages"
            className="group rounded-xl border border-line bg-card px-4 py-4 transition-all duration-150 hover:border-line-strong hover:shadow-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">This Week</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-ink">
              {weekCount}
            </p>
            <p className="mt-2 flex items-center justify-between text-[11px] text-ink-3">
              <span>campaigns sent</span>
              <ArrowRight size={10} className="text-line-strong group-hover:text-ink-3 transition-colors" />
            </p>
          </Link>

          {/* Delivery Rate */}
          <div className="rounded-xl border border-t-2 border-t-emerald-500 border-line bg-card px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Delivery Rate</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-ink">
              {delivRate ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-ink-3">last 30 days</p>
          </div>

          {/* Open Rate */}
          <div
            className={[
              "rounded-xl border bg-card px-4 py-4",
              hasOpenData ? "border-t-2 border-t-sky-500 border-line" : "border-line",
            ].join(" ")}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3" title={OPENED_EXPLAINER}>Opened (may be automatic)</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-ink">
              {openRate ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-ink-3" title={OPENED_EXPLAINER}>email, last 30d · unreliable</p>
          </div>

          {/* Confirmed or read — the signal that is certain */}
          <div
            className={[
              "rounded-xl border bg-card px-4 py-4",
              seenPossible.size > 0 ? "border-t-2 border-t-emerald-500 border-line" : "border-line",
            ].join(" ")}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3" title={CONFIRMED_EXPLAINER}>Confirmed or read</p>
            <p className="mt-2.5 text-[30px] font-semibold tracking-tight tabular-nums leading-none text-ink">
              {seenRate ?? "—"}
            </p>
            <p className="mt-2 text-[11px] text-ink-3">
              {seenPossible.size > 0 ? `${seenDone.size.toLocaleString()} of ${seenPossible.size.toLocaleString()} · last 30d` : "needs “I’ve read this” or WhatsApp"}
            </p>
          </div>
        </div>

        {/* ── Sections 2 + 4 + 5 — Main grid ──────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-5">

          {/* ── Section 2 — Activity Feed (3/5) ──────────────────────────── */}
          <div className="lg:col-span-3 rounded-xl border border-line bg-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-muted-2">
              <div>
                <h2 className="text-[13px] font-semibold text-ink">Activity</h2>
                <p className="mt-0.5 text-[11px] text-ink-3">Campaigns, imports, and contact changes</p>
              </div>
              <Link
                href="/activity"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink-2 transition-colors"
              >
                View all <ArrowRight size={10} />
              </Link>
            </div>

            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-canvas mb-4">
                  <Send size={17} className="text-line-strong" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-semibold text-ink">No activity yet</p>
                <p className="mt-1 text-[12px] text-ink-3">
                  Send your first message to get started.
                </p>
                <Link
                  href="/messages/new"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-canvas transition-colors"
                >
                  <Plus size={11} strokeWidth={2.5} /> Compose
                </Link>
              </div>
            ) : (
              <div>
                {feed.map((item, i) => {
                  const isLast = i === feed.length - 1;
                  const rowCls = `flex items-start gap-3 px-5 py-4 transition-colors hover:bg-canvas ${!isLast ? "border-b border-muted" : ""}`;

                  if (item.kind === "import") {
                    return (
                      <div key={item.id} className={rowCls}>
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Upload size={12} className="text-ink-3" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-ink leading-snug">
                            <span className="font-medium">Imported {item.count.toLocaleString()} contacts</span>
                            <span className="text-ink-2"> · {item.fileName}</span>
                          </p>
                        </div>
                        <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-ink-3">
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
                          <p className="text-[13px] font-medium text-ink truncate leading-snug">
                            {item.subject}
                          </p>
                          <span
                            className={`shrink-0 inline-flex items-center gap-[3px] rounded-full px-1.5 py-px text-[9px] font-semibold ${meta.bg} ${meta.color}`}
                          >
                            <CIcon size={8} strokeWidth={2.5} />
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-ink-3 leading-snug">
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
                      <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-ink-3">
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
            <div className="rounded-xl border border-line bg-card shadow-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-muted-2">
                <h2 className="text-[13px] font-semibold text-ink">Quick Actions</h2>
              </div>
              <div className="divide-y divide-muted">
                {QUICK_ACTIONS.map(({ href, Icon, label, sub }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-canvas"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-card group-hover:border-line-strong transition-colors">
                      <Icon size={13} className="text-ink-2" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink">{label}</p>
                      <p className="text-[11px] text-ink-3">{sub}</p>
                    </div>
                    <ChevronRight
                      size={13}
                      className="text-line-strong group-hover:text-ink-3 shrink-0 transition-colors"
                    />
                  </Link>
                ))}
              </div>
            </div>

            {/* Section 4 — Audience Breakdown / Directory */}
            <div className="rounded-xl border border-line bg-card shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-muted-2">
                <h2 className="text-[13px] font-semibold text-ink">Directory</h2>
                <Link
                  href="/people"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3 hover:text-ink-2 transition-colors"
                >
                  View all <ArrowRight size={10} />
                </Link>
              </div>

              {audiences.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-canvas mx-auto mb-3">
                    <Users size={14} className="text-line-strong" strokeWidth={1.5} />
                  </div>
                  <p className="text-[12px] text-ink-2 font-medium">No contacts yet</p>
                  <Link
                    href="/imports"
                    className="mt-1.5 inline-block text-[11px] text-ink-3 hover:text-ink-2 transition-colors"
                  >
                    Import contacts →
                  </Link>
                </div>
              ) : (
                <div className="px-5 py-1">
                  {audiences.map(([cat, count]) => {
                    const share = contacts > 0 ? count / contacts : 0;
                    return (
                      <div key={cat} className="flex items-center gap-3 py-2.5 border-b border-muted last:border-0">
                        <span className="flex-1 text-[12px] text-ink-2">
                          {AUDIENCE_LABELS[cat] ?? cat}
                        </span>
                        <div className="w-16 h-1 rounded-full bg-muted-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-line-strong"
                            style={{ width: `${Math.round(share * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[13px] font-medium tabular-nums text-ink">
                          {count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                  {uncategorized > 0 && (
                    <div className="flex items-center gap-3 py-2.5">
                      <span className="flex-1 text-[12px] text-ink-3">Uncategorized</span>
                      <div className="w-16 h-1 rounded-full bg-muted-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-line"
                          style={{ width: `${Math.round((uncategorized / contacts) * 100)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-[13px] font-medium tabular-nums text-ink-3">
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
