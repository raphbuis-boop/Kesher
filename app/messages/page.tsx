export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { describeClockRule, formatInZone, getSchoolTimezone, validClockRule } from "@/lib/schoolTime";
import { describeZmanimRule, validZmanimRule } from "@/lib/zmanim";
import { getDispatcherHealth } from "@/lib/send/health";
import { getHebrewDateStyle, hebrewDateString } from "@/lib/hebrewDate";
import { MessageRowActions, RecurringRowActions } from "./RowActions";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { AdminOnly } from "@/app/components/AdminOnly";
import { Plus, Mail, Smartphone, MessageSquare, Send } from "lucide-react";
import { Pagination, parsePage } from "@/app/components/ui/Pagination";

const PAGE_SIZE = 50;

type Message = {
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
  scheduled_for?: string | null;
  rejection_reason?: string | null;
  recurring_id?: string | null;
};

type Recurring = { id: string; name: string; active: boolean; rule: unknown; audience_label: string; next_run_at: string | null; timezone: string };

const SENT_STATUSES = ["sending", "sent", "failed"];
const DRAFT_STATUSES = ["draft", "rejected", "cancelled"];
const COLUMNS = "id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at, scheduled_for, rejection_reason, recurring_id";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const CHANNEL_META: Record<
  string,
  { icon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>; label: string; color: string; bg: string }
> = {
  email:    { icon: Mail,          label: "Email",    color: "text-ink-2",    bg: "bg-muted"  },
  sms:      { icon: Smartphone,    label: "SMS",      color: "text-blue-500",    bg: "bg-blue-50"     },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-500", bg: "bg-emerald-50"  },
  multi:    { icon: Send,          label: "Multi",    color: "text-ink-2",    bg: "bg-muted"       },
};

function CampaignStatusDot({ status }: { status: string }) {
  if (status === "sent")
    return <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />;
  if (status === "failed")
    return <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />;
  if (status === "sending")
    return <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />;
  return <span className="inline-flex h-1.5 w-1.5 rounded-full bg-line-strong" />;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page: pageParam } = await searchParams;
  const activeTab = tab ?? "sent";
  const page = parsePage(pageParam);

  const supabase = await createSupabaseServerClient();
  const { orgId, userId, role } = await getMembership();
  const admin = isAdminRole(role);

  // Drafts are personal; waiting requests are everyone's for admins, your own otherwise
  const forTab = (key: string) => {
    let q = supabase.from("messages").select(COLUMNS, { count: "exact" }).eq("org_id", orgId);
    if (key === "sent") q = q.in("status", SENT_STATUSES).order("created_at", { ascending: false });
    else if (key === "drafts") q = q.in("status", DRAFT_STATUSES).eq("created_by", userId).order("created_at", { ascending: false });
    else if (key === "scheduled") q = q.eq("status", "scheduled").order("scheduled_for", { ascending: true });
    else q = (admin ? q : q.eq("created_by", userId)).eq("status", "pending_approval").order("requested_at", { ascending: true });
    return q;
  };
  const countFor = async (key: string) => (await forTab(key).limit(1)).count ?? 0;
  const tabKey = ["sent", "drafts", "scheduled", "approval"].includes(activeTab) ? activeTab : "sent";

  const [{ data, count }, demoLoaded, timezone, health, hebrewStyle, draftsN, scheduledN, approvalN, recurringRes] = await Promise.all([
    forTab(tabKey).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    isDemoWorkspaceLoaded(supabase, orgId),
    getSchoolTimezone(supabase, orgId),
    getDispatcherHealth(supabase),
    getHebrewDateStyle(supabase, orgId),
    countFor("drafts"),
    countFor("scheduled"),
    countFor("approval"),
    supabase.from("recurring_sends").select("id, name, active, rule, audience_label, next_run_at, timezone").eq("org_id", orgId).order("created_at", { ascending: false }),
  ]);

  const messages = (data ?? []) as Message[];
  const recurring = (recurringRes.data ?? []) as Recurring[];
  const totalMessages = tabKey === "sent" ? (count ?? messages.length) : await countFor("sent");

  const TABS = [
    { key: "sent",      label: "Sent",      count: totalMessages },
    { key: "drafts",    label: "Drafts",    count: draftsN },
    { key: "scheduled", label: "Scheduled", count: scheduledN + recurring.filter((r) => r.active).length },
    { key: "approval",  label: admin ? "Needs approval" : "My requests", count: approvalN },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="px-6 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[13px] font-semibold text-ink">Messages</h1>
              <p className="text-[11px] text-ink-3 mt-px">{totalMessages.toLocaleString()} sent</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {demoLoaded && <AdminOnly><DemoWorkspaceControl mode="remove" /></AdminOnly>}
              <Link
                href="/messages/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-on-ink hover:bg-ink-hover"
              >
                <Plus size={12} strokeWidth={2.5} />
                Compose
              </Link>
            </div>
          </div>
        </div>

        <div role="tablist" className="flex px-6 gap-0">
          {TABS.map((t) => (
            <Link
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              aria-current={activeTab === t.key ? "page" : undefined}
              href={t.key === "sent" ? "/messages" : `/messages?tab=${t.key}`}
              className={[
                "inline-flex items-center gap-1.5 border-b-[1.5px] px-1 mr-4 pb-2.5 pt-0 text-[12px] font-medium transition-all duration-100",
                activeTab === t.key
                  ? "border-ink text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              ].join(" ")}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`tabular-nums text-[10px] ${activeTab === t.key ? "text-ink-2" : "text-line-strong"}`}>
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-4">
        {tabKey !== "sent" ? (
          <div className="space-y-4">
            {tabKey === "scheduled" && (scheduledN > 0 || recurring.some((r) => r.active)) && !health.healthy && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
                Scheduled messages aren&apos;t being sent: the background sender hasn&apos;t checked in{health.lastRunAt ? ` since ${formatInZone(health.lastRunAt, timezone)}` : " yet"}.{" "}
                {admin ? <>Set it up once in <Link href="/settings#messaging" className="underline">Settings → Messaging</Link>.</> : "Ask an admin to check Settings → Messaging."}
              </div>
            )}

            {tabKey === "scheduled" && recurring.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
                <div className="border-b border-muted-2 bg-canvas px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">Repeating sends</div>
                {recurring.map((r, i) => (
                  <div key={r.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${i < recurring.length - 1 ? "border-b border-muted" : ""}`}>
                    <div className="min-w-0">
                      <p dir="auto" className="truncate text-[13px] font-medium text-ink">{r.name}</p>
                      <p className="text-[11px] text-ink-3">
                        {validClockRule(r.rule) ? describeClockRule(r.rule) : validZmanimRule(r.rule) ? describeZmanimRule(r.rule) : "Custom schedule"} · {r.audience_label}
                        {" · "}
                        {r.active ? (r.next_run_at ? `next ${formatInZone(r.next_run_at, r.timezone)}${hebrewStyle !== "off" ? ` · ${hebrewDateString(r.next_run_at, r.timezone, hebrewStyle)}` : ""}` : "no upcoming date") : "paused"}
                      </p>
                    </div>
                    {admin && <RecurringRowActions id={r.id} active={r.active} />}
                  </div>
                ))}
              </div>
            )}

            {messages.length === 0 ? (
              tabKey === "scheduled" && recurring.length > 0 ? null : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-20 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card">
                    <Send size={18} className="text-line-strong" strokeWidth={1.5} />
                  </div>
                  <p className="text-[13px] font-semibold text-ink">
                    {tabKey === "drafts" && "No drafts saved"}
                    {tabKey === "scheduled" && "Nothing scheduled"}
                    {tabKey === "approval" && (admin ? "Nothing waiting for approval" : "No requests waiting")}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-3">
                    {tabKey === "drafts" && "Use Save draft in the composer to pick a message up later."}
                    {tabKey === "scheduled" && "Choose Schedule for later in the composer to send at a set time, or repeat weekly."}
                    {tabKey === "approval" && "Messages from members that need an admin's OK show up here."}
                  </p>
                </div>
              )
            ) : (
              <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
                {messages.map((msg, i) => {
                  const meta = CHANNEL_META[msg.channel] ?? CHANNEL_META.email;
                  const ChannelIcon = meta.icon;
                  return (
                    <div key={msg.id} className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${i < messages.length - 1 ? "border-b border-muted" : ""}`}>
                      <div className="min-w-0">
                        <p dir="auto" className="truncate text-[13px] font-medium text-ink">
                          {msg.subject?.trim() || (msg.body.trim() ? msg.body.replace(/\{\{(\w+)\}\}/g, "[$1]").slice(0, 70) + (msg.body.length > 70 ? "…" : "") : "(no text yet)")}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
                            <ChannelIcon size={9} strokeWidth={2} />
                            {meta.label}
                          </span>
                          <span>{msg.audience_label}</span>
                          {msg.status === "scheduled" && msg.scheduled_for && <span className="font-medium text-ink-2">{formatInZone(msg.scheduled_for, timezone)}{hebrewStyle !== "off" && <span dir="auto"> · {hebrewDateString(msg.scheduled_for, timezone, hebrewStyle)}</span>}{msg.recurring_id ? " · repeating" : ""}</span>}
                          {msg.status === "pending_approval" && <span className="font-medium text-amber-700">Waiting for approval{msg.scheduled_for ? ` · wanted ${formatInZone(msg.scheduled_for, timezone)}` : ""}</span>}
                          {msg.status === "rejected" && <span className="font-medium text-red-600">Sent back{msg.rejection_reason ? `: ${msg.rejection_reason}` : ""}</span>}
                          {msg.status === "cancelled" && <span>Cancelled</span>}
                          {msg.status === "draft" && <span>Saved {timeAgo(msg.created_at)}</span>}
                        </p>
                      </div>
                      <MessageRowActions id={msg.id} kind={tabKey === "drafts" ? "draft" : tabKey === "scheduled" ? "scheduled" : "approval"} isAdmin={admin} />
                    </div>
                  );
                })}
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={count ?? messages.length}
                  buildHref={(p) => (p === 1 ? `/messages?tab=${tabKey}` : `/messages?tab=${tabKey}&page=${p}`)}
                />
              </div>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-line mb-4">
              <Send size={18} className="text-line-strong" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-ink">No messages yet</p>
            <p className="text-[12px] text-ink-3 mt-1">Send your first message to your school community.</p>
            <Link
              href="/messages/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[12px] font-medium text-on-ink hover:bg-ink-hover transition-colors"
            >
              <Plus size={12} strokeWidth={2.5} /> Compose Message
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-muted-2 bg-canvas">
                  <th className="py-2.5 pl-5 pr-3 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Subject</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Channel</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Audience</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Sent</th>
                  <th className="pl-3 pr-5 py-2.5 text-right text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Sent</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, i) => {
                  const meta        = CHANNEL_META[msg.channel] ?? CHANNEL_META.email;
                  const ChannelIcon = meta.icon;
                  const isLast      = i === messages.length - 1;
                  const sent        = msg.sent_count ?? 0;
                  const total       = msg.recipient_count;
                  const sentPct     = total > 0 ? Math.round((sent / total) * 100) : 0;
                  const failed      = msg.failed_count ?? 0;

                  return (
                    <tr
                      key={msg.id}
                      className={`group hover:bg-canvas transition-colors duration-100 ${!isLast ? "border-b border-muted" : ""}`}
                    >
                      {/* Subject */}
                      <td className="py-3.5 pl-5 pr-3">
                        <Link
                          href={`/messages/${msg.id}`}
                          className="flex items-center gap-2"
                        >
                          <CampaignStatusDot status={msg.status} />
                          <span className="text-[13px] font-medium text-ink hover:text-ink-hover leading-snug">
                            {msg.subject ?? msg.body.replace(/\{\{(\w+)\}\}/g, "[$1]").slice(0, 55) + (msg.body.length > 55 ? "…" : "")}
                          </span>
                        </Link>
                      </td>

                      {/* Channel */}
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.bg} ${meta.color}`}>
                          <ChannelIcon size={10} strokeWidth={2} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Audience */}
                      <td className="px-3 py-3.5">
                        <span className="text-[12px] text-ink-2">{msg.audience_label}</span>
                      </td>

                      {/* Delivery stats */}
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] tabular-nums text-ink">
                              {sent.toLocaleString()}
                              <span className="text-ink-3">/{total.toLocaleString()}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] tabular-nums font-medium text-ink-2">{sentPct}%</span>
                              {failed > 0 && (
                                <span className="text-[10px] tabular-nums text-red-400 font-medium">
                                  {failed} failed
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-muted-2">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${sentPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="pl-3 pr-5 py-3.5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[11px] tabular-nums text-ink-3">
                            {timeAgo(msg.sent_at ?? msg.created_at)}
                          </span>
                          <Link
                            href={`/messages/${msg.id}`}
                            className="text-[10px] font-medium text-ink-3 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:text-ink"
                          >
                            View →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={totalMessages}
              buildHref={(p) => (p === 1 ? "/messages" : `/messages?page=${p}`)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
