export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
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
};

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
  const orgId = await getOrgId();
  const [{ data, count }, demoLoaded] = await Promise.all([
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    isDemoWorkspaceLoaded(supabase, orgId),
  ]);

  const messages = (data ?? []) as Message[];
  const totalMessages = count ?? messages.length;

  const TABS = [
    { key: "sent",      label: "Sent",      count: totalMessages },
    { key: "drafts",    label: "Drafts",    count: 0 },
    { key: "scheduled", label: "Scheduled", count: 0 },
    { key: "templates", label: "Templates", count: 0 },
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
              {demoLoaded && <DemoWorkspaceControl mode="remove" />}
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
        {activeTab !== "sent" ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card border border-line mb-4">
              <Send size={18} className="text-line-strong" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-ink">
              {activeTab === "drafts"    && "No drafts saved"}
              {activeTab === "scheduled" && "No scheduled messages"}
              {activeTab === "templates" && "No templates created"}
            </p>
            <p className="text-[12px] text-ink-3 mt-1">Coming soon.</p>
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
