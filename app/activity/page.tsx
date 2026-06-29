export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
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

function MessageEventRow({ event }: { event: MessageEvent }) {
  return (
    <div className="flex gap-4 py-3.5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white">
        <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-900 truncate">
            {event.subject ?? event.body.slice(0, 60) + (event.body.length > 60 ? "…" : "")}
          </span>
          <ChannelBadge channel={event.channel} />
          {event.status === "failed" && (
            <span className="text-[11px] font-medium text-red-500">Failed</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-400">
          <span>To {event.audience_label}</span>
          {event.sent_count != null && (
            <span>{event.sent_count.toLocaleString()} delivered</span>
          )}
          {event.failed_count != null && event.failed_count > 0 && (
            <span className="text-red-400">{event.failed_count} failed</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-[11px] tabular-nums text-zinc-400">
        {formatTime(event.created_at)}
      </div>
    </div>
  );
}

function ImportEventRow({ event }: { event: ImportEvent }) {
  return (
    <div className="flex gap-4 py-3.5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white">
        <svg className="h-3 w-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-900 truncate">
          {event.file_name}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-400">
          <span>Imported {event.imported_count.toLocaleString()} contacts</span>
          {event.failed_count != null && event.failed_count > 0 && (
            <span className="text-amber-500">{event.failed_count} skipped</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-[11px] tabular-nums text-zinc-400">
        {formatTime(event.created_at)}
      </div>
    </div>
  );
}

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();

  const [messagesResult, importsResult] = await Promise.all([
    supabase
      .from("messages")
      .select("id, subject, body, channel, audience_label, sent_count, failed_count, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("imports")
      .select("id, file_name, imported_count, failed_count, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const messageEvents: MessageEvent[] = (messagesResult.data ?? []).map((m) => ({
    kind: "message" as const,
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
    kind: "import" as const,
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">Activity</h1>
            <p className="mt-0.5 text-xs text-zinc-400">
              {allEvents.length} events
            </p>
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        {allEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-20 text-center">
            <p className="text-sm font-medium text-zinc-500">No activity yet</p>
            <p className="mt-1 text-xs text-zinc-400">
              Messages sent and imports will appear here.
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/messages/new"
                className="text-xs font-medium text-zinc-900 hover:text-zinc-600 transition-colors"
              >
                Send a message →
              </Link>
              <Link
                href="/imports"
                className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                Import contacts →
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            {allEvents.map((event, i) => {
              const prev = allEvents[i - 1];
              const showDateHeader = !prev || !isSameDay(event.created_at, prev.created_at);
              return (
                <div key={event.id}>
                  {showDateHeader && (
                    <div className={`${i > 0 ? "mt-6" : ""} mb-1 pb-1.5 border-b border-zinc-100`}>
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                  )}
                  <div className="border-b border-zinc-50 last:border-0">
                    {event.kind === "message" ? (
                      <MessageEventRow event={event} />
                    ) : (
                      <ImportEventRow event={event} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
