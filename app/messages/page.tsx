export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { isDemoWorkspaceLoaded } from "@/lib/demoWorkspace";
import { DemoWorkspaceControl } from "@/app/components/DemoWorkspaceControl";
import { Plus, Mail, Smartphone, MessageSquare, Send } from "lucide-react";

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
  email:    { icon: Mail,          label: "Email",    color: "text-text-muted",    bg: "bg-surface-2"  },
  sms:      { icon: Smartphone,    label: "SMS",      color: "text-info",    bg: "bg-info-tint"     },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-success", bg: "bg-success-tint"  },
};

const STATUS_DOT: Record<string, { cls: string; label: string }> = {
  sent:    { cls: "bg-success-solid", label: "Sent" },
  failed:  { cls: "bg-danger-solid",  label: "Failed" },
  sending: { cls: "bg-warning-solid", label: "Sending" },
};

function CampaignStatusDot({ status }: { status: string }) {
  const meta = STATUS_DOT[status] ?? { cls: "bg-text-faint", label: status };
  return (
    <>
      <span aria-hidden className={`inline-flex h-1.5 w-1.5 shrink-0 rounded-full ${meta.cls}`} />
      <span className="sr-only">{meta.label}:</span>
    </>
  );
}

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const [{ data }, demoLoaded] = await Promise.all([
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    isDemoWorkspaceLoaded(supabase, orgId),
  ]);

  const messages = (data ?? []) as Message[];

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-text-primary">Messages</h1>
            <p className="text-[11px] text-text-subtle mt-px">{messages.length.toLocaleString()} sent</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {demoLoaded && <DemoWorkspaceControl mode="badge" />}
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-fg hover:bg-primary-hover"
            >
              <Plus aria-hidden size={12} strokeWidth={2.5} />
              Compose
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border mb-4">
              <Send aria-hidden size={18} className="text-text-faint" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-text-primary">No messages yet</p>
            <p className="text-[12px] text-text-subtle mt-1">Send your first message to your school community.</p>
            <Link
              href="/messages/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12px] font-medium text-primary-fg hover:bg-primary-hover transition-colors"
            >
              <Plus size={12} strokeWidth={2.5} /> Compose Message
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-background">
                  <th className="py-2.5 pl-5 pr-3 text-left text-[10px] font-semibold text-text-subtle uppercase tracking-wide">Subject</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-subtle uppercase tracking-wide">Channel</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-subtle uppercase tracking-wide">Audience</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-text-subtle uppercase tracking-wide">Delivery</th>
                  <th className="pl-3 pr-5 py-2.5 text-right text-[10px] font-semibold text-text-subtle uppercase tracking-wide">Sent</th>
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
                      className={`group hover:bg-surface-hover transition-colors duration-100 ${!isLast ? "border-b border-border-subtle" : ""}`}
                    >
                      {/* Subject */}
                      <td className="py-3.5 pl-5 pr-3">
                        <Link
                          href={`/messages/${msg.id}`}
                          className="flex items-center gap-2"
                        >
                          <CampaignStatusDot status={msg.status} />
                          <span className="text-[13px] font-medium text-text-primary leading-snug group-hover:underline underline-offset-2">
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
                        <span className="text-[12px] text-text-muted">{msg.audience_label}</span>
                      </td>

                      {/* Delivery stats */}
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col gap-1.5 min-w-[120px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] tabular-nums text-text-primary">
                              {sent.toLocaleString()}
                              <span className="text-text-subtle">/{total.toLocaleString()}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] tabular-nums font-medium text-text-muted">{sentPct}%</span>
                              {failed > 0 && (
                                <span className="text-[10px] tabular-nums text-danger font-medium">
                                  {failed} failed
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
                            <div
                              className="h-full rounded-full bg-success-solid"
                              style={{ width: `${sentPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="pl-3 pr-5 py-3.5 text-right">
                        <span className="text-[11px] tabular-nums text-text-subtle">
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
