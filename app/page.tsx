export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  Users,
  Send,
  Inbox,
  Plus,
  FileText,
  Mail,
  MessageSquare,
  Smartphone,
  ArrowRight,
} from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

const CHANNEL_ICON: Record<string, React.FC<{ size?: number; className?: string; strokeWidth?: number }>> = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageSquare,
};

const CHANNEL_COLOR: Record<string, string> = {
  email: "text-zinc-500",
  sms: "text-blue-500",
  whatsapp: "text-emerald-500",
};

function StatusPill({ status }: { status: string }) {
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
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
      {status}
    </span>
  );
}

export default async function OverviewPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { count: totalContacts },
    { data: messageRows },
    { data: recentMessages },
    { data: recentImports },
  ] = await Promise.all([
    supabase.from("people").select("*", { count: "exact", head: true }),
    supabase.from("messages").select("sent_count, recipient_count"),
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, sent_count, status, sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, created_at")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const contacts = totalContacts ?? 0;
  const totalSent = (messageRows ?? []).reduce((s, m) => s + (m.sent_count ?? 0), 0);
  const totalMessages = (messageRows ?? []).length;
  const messages = recentMessages ?? [];
  const imports = recentImports ?? [];

  const stats = [
    { label: "Total contacts", value: contacts.toLocaleString(), icon: Users, href: "/people", sublabel: "in directory" },
    { label: "Messages sent", value: totalMessages.toLocaleString(), icon: Send, href: "/messages", sublabel: "all time" },
    { label: "Recipients reached", value: totalSent.toLocaleString(), icon: Inbox, href: "/activity", sublabel: "all time" },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-semibold text-[#0f0f0f]">Overview</h1>
            <p className="text-[11px] text-[#a1a1aa] mt-px">Heichal HaTorah</p>
          </div>
          <Link
            href="/messages/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 hover:bg-[#27272a] active:bg-black"
          >
            <Plus size={12} strokeWidth={2.5} />
            Compose
          </Link>
        </div>
      </header>

      <div className="px-6 py-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                href={s.href}
                className="group flex flex-col rounded-xl border border-[#e7e7e7] bg-white p-5 transition-all duration-150 hover:border-[#d4d4d8] hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-[#a1a1aa] uppercase tracking-wide">{s.label}</span>
                  <Icon size={13} className="text-[#d4d4d8] group-hover:text-[#a1a1aa] transition-colors" strokeWidth={1.75} />
                </div>
                <div className="text-[32px] font-semibold tracking-tight text-[#0f0f0f] tabular-nums leading-none">
                  {s.value}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-[#a1a1aa]">{s.sublabel}</span>
                  <ArrowRight size={11} className="text-[#d4d4d8] group-hover:text-[#a1a1aa] transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Recent Messages — 2/3 */}
          <div className="col-span-2 rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
              <h2 className="text-[12px] font-semibold text-[#0f0f0f]">Recent messages</h2>
              <Link
                href="/messages"
                className="text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors flex items-center gap-1"
              >
                View all <ArrowRight size={10} />
              </Link>
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fafafa] border border-[#e7e7e7] mb-3">
                  <Send size={15} className="text-[#d4d4d8]" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-medium text-[#71717a]">No messages yet</p>
                <p className="text-[11px] text-[#a1a1aa] mt-1">Send your first message to get started.</p>
                <Link
                  href="/messages/new"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#e7e7e7] px-3 py-1.5 text-[12px] font-medium text-[#0f0f0f] hover:bg-[#fafafa] transition-colors"
                >
                  <Plus size={11} strokeWidth={2.5} /> Compose
                </Link>
              </div>
            ) : (
              <div>
                {messages.map((msg, i) => {
                  const ChannelIcon = CHANNEL_ICON[msg.channel] ?? Mail;
                  const isLast = i === messages.length - 1;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-center gap-3 px-5 py-3 hover:bg-[#fafafa] transition-colors group cursor-default ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fafafa] border border-[#f0f0f0]">
                        <ChannelIcon size={12} className={CHANNEL_COLOR[msg.channel] ?? "text-zinc-400"} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#0f0f0f] truncate">
                          {msg.subject ?? msg.body.slice(0, 55) + (msg.body.length > 55 ? "…" : "")}
                        </p>
                        <p className="text-[11px] text-[#a1a1aa] mt-px">{msg.audience_label}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <StatusPill status={msg.status} />
                        <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                          {timeAgo(msg.sent_at ?? msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Imports — 1/3 */}
          <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
              <h2 className="text-[12px] font-semibold text-[#0f0f0f]">Recent imports</h2>
              <Link
                href="/imports"
                className="text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors flex items-center gap-1"
              >
                View all <ArrowRight size={10} />
              </Link>
            </div>

            {imports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fafafa] border border-[#e7e7e7] mb-3">
                  <FileText size={15} className="text-[#d4d4d8]" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-medium text-[#71717a]">No imports yet</p>
                <Link
                  href="/imports"
                  className="mt-3 text-[11px] text-[#a1a1aa] hover:text-[#71717a] transition-colors"
                >
                  Import contacts →
                </Link>
              </div>
            ) : (
              <div>
                {imports.map((imp, i) => {
                  const isLast = i === imports.length - 1;
                  return (
                    <div
                      key={imp.id}
                      className={`px-5 py-3.5 hover:bg-[#fafafa] transition-colors ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <FileText size={13} className="text-[#d4d4d8] mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-[#0f0f0f] truncate">{imp.file_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-[#a1a1aa]">
                              {imp.imported_count.toLocaleString()} contacts
                            </span>
                            <span className="text-[#d4d4d8] text-[10px]">·</span>
                            <span className="text-[11px] text-[#a1a1aa]">{timeAgo(imp.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <Link
                  href="/imports"
                  className="flex items-center justify-center gap-1.5 px-5 py-3 border-t border-[#f5f5f5] text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] hover:bg-[#fafafa] transition-colors"
                >
                  <Plus size={11} strokeWidth={2.5} /> Import contacts
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
