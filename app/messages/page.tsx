export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatDate(d);
}

const CHANNEL_META: Record<string, { icon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-zinc-500" },
  sms: { icon: Smartphone, label: "SMS", color: "text-blue-500" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-500" },
};

function StatusBadge({ status }: { status: string }) {
  if (status === "sent")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        <span className="h-1 w-1 rounded-full bg-emerald-500" />
        Sent
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
        <span className="h-1 w-1 rounded-full bg-red-500" />
        Failed
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
      {status}
    </span>
  );
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab ?? "sent";

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("messages")
    .select("id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at")
    .order("created_at", { ascending: false });

  const messages = (data ?? []) as Message[];

  const TABS = [
    { key: "sent", label: "Sent", count: messages.length },
    { key: "drafts", label: "Drafts", count: 0 },
    { key: "scheduled", label: "Scheduled", count: 0 },
    { key: "templates", label: "Templates", count: 0 },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm">
        <div className="px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[13px] font-semibold text-[#0f0f0f]">Messages</h1>
              <p className="text-[11px] text-[#a1a1aa] mt-px">{messages.length.toLocaleString()} sent</p>
            </div>
            <Link
              href="/messages/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-[#27272a] active:bg-black"
            >
              <Plus size={12} strokeWidth={2.5} />
              Compose
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-0">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "sent" ? "/messages" : `/messages?tab=${t.key}`}
              className={[
                "inline-flex items-center gap-1.5 border-b-[1.5px] px-1 mr-4 pb-2.5 pt-0 text-[12px] font-medium transition-all duration-100",
                activeTab === t.key
                  ? "border-[#0f0f0f] text-[#0f0f0f]"
                  : "border-transparent text-[#a1a1aa] hover:text-[#71717a]",
              ].join(" ")}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`tabular-nums text-[10px] ${activeTab === t.key ? "text-[#71717a]" : "text-[#d4d4d8]"}`}>
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#e7e7e7] mb-4">
              <Send size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-[#0f0f0f]">
              {activeTab === "drafts" && "No drafts saved"}
              {activeTab === "scheduled" && "No scheduled messages"}
              {activeTab === "templates" && "No templates created"}
            </p>
            <p className="text-[12px] text-[#a1a1aa] mt-1">Coming soon.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#e7e7e7] mb-4">
              <Send size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-[#0f0f0f]">No messages yet</p>
            <p className="text-[12px] text-[#a1a1aa] mt-1">Send your first message to your school community.</p>
            <Link
              href="/messages/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3.5 py-2 text-[12px] font-medium text-white hover:bg-[#27272a] transition-colors"
            >
              <Plus size={12} strokeWidth={2.5} /> Compose Message
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Subject</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Channel</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Audience</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Delivered</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wide">Sent</th>
                  <th className="pl-3 pr-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {messages.map((msg, i) => {
                  const meta = CHANNEL_META[msg.channel] ?? CHANNEL_META.email;
                  const ChannelIcon = meta.icon;
                  const isLast = i === messages.length - 1;
                  return (
                    <tr
                      key={msg.id}
                      className={`group hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                    >
                      <td className="py-3 pl-4 pr-3">
                        <Link
                          href={`/messages/${msg.id}`}
                          className="text-[13px] font-medium text-[#0f0f0f] hover:text-[#27272a]"
                        >
                          {msg.subject ?? msg.body.slice(0, 55) + (msg.body.length > 55 ? "…" : "")}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <ChannelIcon size={12} className={meta.color} strokeWidth={1.75} />
                          <span className="text-[11px] font-medium text-[#71717a]">{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-[12px] text-[#71717a]">{msg.audience_label}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-[13px] tabular-nums text-[#0f0f0f]">
                          {(msg.sent_count ?? msg.recipient_count).toLocaleString()}
                        </span>
                        {msg.failed_count != null && msg.failed_count > 0 && (
                          <span className="ml-1 text-[11px] tabular-nums text-red-400">
                            ·{msg.failed_count}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={msg.status} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                          {timeAgo(msg.sent_at ?? msg.created_at)}
                        </span>
                      </td>
                      <td className="pl-3 pr-4 py-3 text-right">
                        <Link
                          href={`/messages/${msg.id}`}
                          className="text-[11px] font-medium text-[#a1a1aa] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#0f0f0f]"
                        >
                          View →
                        </Link>
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
