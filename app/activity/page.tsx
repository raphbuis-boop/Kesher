export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { Mail, Smartphone, MessageSquare, FileText, Plus } from "lucide-react";

type MessageEvent = {
  kind: "message";
  id: string;
  subject: string | null;
  body: string;
  channel: string;
  audience_label: string;
  sent_count: number | null;
  failed_count: number | null;
  status: string;
  created_at: string;
};

type ImportEvent = {
  kind: "import";
  id: string;
  file_name: string;
  imported_count: number;
  failed_count: number | null;
  created_at: string;
};

type ActivityEvent = MessageEvent | ImportEvent;

function formatDayLabel(d: string) {
  const date = new Date(d);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function isSameDay(a: string, b: string) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

const CHANNEL_META: Record<string, { icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }>; color: string; label: string }> = {
  email: { icon: Mail, color: "text-zinc-500", label: "Email" },
  sms: { icon: Smartphone, color: "text-blue-500", label: "SMS" },
  whatsapp: { icon: MessageSquare, color: "text-emerald-500", label: "WhatsApp" },
};

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  const [messagesResult, importsResult] = await Promise.all([
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, sent_count, failed_count, status, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, failed_count, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const messageEvents: MessageEvent[] = (messagesResult.data ?? []).map((m) => ({
    kind: "message",
    id: m.id,
    subject: m.subject,
    body: m.body,
    channel: m.channel,
    audience_label: m.audience_label,
    sent_count: m.sent_count,
    failed_count: m.failed_count,
    status: m.status,
    created_at: m.created_at,
  }));

  const importEvents: ImportEvent[] = (importsResult.data ?? []).map((i) => ({
    kind: "import",
    id: i.id,
    file_name: i.file_name,
    imported_count: i.imported_count,
    failed_count: i.failed_count,
    created_at: i.created_at,
  }));

  const allEvents: ActivityEvent[] = [...messageEvents, ...importEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[13px] font-semibold text-[#0f0f0f]">Activity</h1>
            <p className="text-[11px] text-[#a1a1aa] mt-px">
              {allEvents.length} event{allEvents.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        {allEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e7e7e7] py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#e7e7e7] mb-4">
              <Mail size={18} className="text-[#d4d4d8]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-[#0f0f0f]">No activity yet</p>
            <p className="text-[12px] text-[#a1a1aa] mt-1 max-w-xs">
              Messages and imports will appear here as they happen.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Link
                href="/messages/new"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0f0f0f] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#27272a] transition-colors"
              >
                <Plus size={11} strokeWidth={2.5} /> Send a message
              </Link>
              <Link
                href="/imports"
                className="text-[12px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
              >
                Import contacts
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl space-y-6">
            {(() => {
              const groups: { label: string; events: ActivityEvent[] }[] = [];
              for (const event of allEvents) {
                const last = groups[groups.length - 1];
                if (!last || !isSameDay(event.created_at, last.events[0].created_at)) {
                  groups.push({ label: formatDayLabel(event.created_at), events: [event] });
                } else {
                  last.events.push(event);
                }
              }
              return groups.map((group) => (
                <div key={group.label}>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-[#f0f0f0]" />
                  </div>
                  <div className="rounded-xl border border-[#e7e7e7] bg-white overflow-hidden">
                    {group.events.map((event, i) => {
                      const isLast = i === group.events.length - 1;
                      if (event.kind === "message") {
                        const meta = CHANNEL_META[event.channel] ?? CHANNEL_META.email;
                        const ChannelIcon = meta.icon;
                        return (
                          <Link
                            key={event.id}
                            href={`/messages/${event.id}`}
                            className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                          >
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fafafa] border border-[#f0f0f0]">
                              <ChannelIcon size={12} className={meta.color} strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-[#0f0f0f] truncate">
                                {event.subject ?? event.body.slice(0, 60) + (event.body.length > 60 ? "…" : "")}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#a1a1aa]">
                                <span>{meta.label}</span>
                                <span className="text-[#d4d4d8]">·</span>
                                <span>{event.audience_label}</span>
                                {event.sent_count != null && (
                                  <>
                                    <span className="text-[#d4d4d8]">·</span>
                                    <span>{event.sent_count.toLocaleString()} delivered</span>
                                  </>
                                )}
                                {event.failed_count != null && event.failed_count > 0 && (
                                  <>
                                    <span className="text-[#d4d4d8]">·</span>
                                    <span className="text-red-400">{event.failed_count} failed</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              {event.status === "sent" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                  <span className="h-1 w-1 rounded-full bg-emerald-500" />Sent
                                </span>
                              ) : event.status === "failed" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                                  <span className="h-1 w-1 rounded-full bg-red-500" />Failed
                                </span>
                              ) : null}
                              <span className="text-[11px] tabular-nums text-[#a1a1aa]">
                                {formatTime(event.created_at)}
                              </span>
                            </div>
                          </Link>
                        );
                      } else {
                        return (
                          <div
                            key={event.id}
                            className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[#fafafa] transition-colors duration-100 ${!isLast ? "border-b border-[#f5f5f5]" : ""}`}
                          >
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fafafa] border border-[#f0f0f0]">
                              <FileText size={12} className="text-[#a1a1aa]" strokeWidth={1.75} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-[#0f0f0f] truncate">{event.file_name}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#a1a1aa]">
                                <span>Import</span>
                                <span className="text-[#d4d4d8]">·</span>
                                <span>{event.imported_count.toLocaleString()} contacts added</span>
                                {event.failed_count != null && event.failed_count > 0 && (
                                  <>
                                    <span className="text-[#d4d4d8]">·</span>
                                    <span className="text-amber-500">{event.failed_count} skipped</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] tabular-nums text-[#a1a1aa]">
                              {formatTime(event.created_at)}
                            </span>
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
