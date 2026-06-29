export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    email: "bg-zinc-100 text-zinc-600",
    sms: "bg-blue-50 text-blue-700",
    whatsapp: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${map[channel] ?? "bg-zinc-100 text-zinc-600"}`}>
      {channel}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent")
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />Sent</span>;
  if (status === "failed")
    return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500"><span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block" />Failed</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400"><span className="h-1.5 w-1.5 rounded-full bg-zinc-300 inline-block" />{status}</span>;
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
    .select(
      "id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at"
    )
    .order("created_at", { ascending: false });

  const messages = (data ?? []) as Message[];

  const tabs = [
    { key: "sent", label: "Sent", count: messages.length },
    { key: "drafts", label: "Drafts", count: 0 },
    { key: "scheduled", label: "Scheduled", count: 0 },
    { key: "templates", label: "Templates", count: 0 },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">Messages</h1>
            <p className="mt-0.5 text-xs text-zinc-400">
              {messages.length.toLocaleString()} sent
            </p>
          </div>
          <Link
            href="/messages/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Compose
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-zinc-100 px-6">
        <div className="flex gap-0">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.key === "sent" ? "/messages" : `/messages?tab=${t.key}`}
              className={
                "inline-flex items-center gap-1.5 border-b-[1.5px] px-1 pb-3 pt-3.5 text-xs font-medium transition-colors " +
                (activeTab === t.key
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-400 hover:text-zinc-700")
              }
            >
              {t.label}
              {t.count > 0 && (
                <span className={`tabular-nums text-[11px] ${activeTab === t.key ? "text-zinc-500" : "text-zinc-300"}`}>
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-4">
        {activeTab !== "sent" ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-20 text-center">
            <p className="text-sm font-medium text-zinc-500">
              {activeTab === "drafts" && "No drafts"}
              {activeTab === "scheduled" && "No scheduled messages"}
              {activeTab === "templates" && "No templates"}
            </p>
            <p className="mt-1 text-xs text-zinc-400">Coming soon.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-20 text-center">
            <p className="text-sm font-medium text-zinc-500">No messages yet</p>
            <p className="mt-1 text-xs text-zinc-400">Send your first message to your school community.</p>
            <Link
              href="/messages/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Compose Message
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="py-2.5 pl-4 pr-3 text-left text-xs font-medium text-zinc-400">Subject</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Channel</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Audience</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-400">Sent</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-zinc-400">Status</th>
                  <th className="pl-3 pr-4 py-2.5 text-right text-xs font-medium text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-3 pl-4 pr-3">
                      <span className="text-sm font-medium text-zinc-900">
                        {msg.subject ?? msg.body.slice(0, 55) + (msg.body.length > 55 ? "…" : "")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <ChannelBadge channel={msg.channel ?? "email"} />
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-zinc-500">{msg.audience_label}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs tabular-nums text-zinc-600">
                        {(msg.sent_count ?? msg.recipient_count).toLocaleString()}
                        {msg.failed_count != null && msg.failed_count > 0 && (
                          <span className="ml-1 text-red-400">·{msg.failed_count}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={msg.status} />
                    </td>
                    <td className="pl-3 pr-4 py-3 text-right">
                      <span className="text-xs tabular-nums text-zinc-400">
                        {formatDate(msg.sent_at ?? msg.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
