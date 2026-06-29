export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
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

function StatusDot({ status }: { status: string }) {
  if (status === "sent") return <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />;
  if (status === "failed") return <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />;
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-300" />;
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
      .limit(6),
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

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <header className="border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-zinc-900">Overview</h1>
            <p className="mt-0.5 text-xs text-zinc-400">Heichal HaTorah</p>
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

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-zinc-100 border-b border-zinc-100">
        <div className="px-6 py-5">
          <div className="text-xs font-medium text-zinc-400">Total contacts</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-zinc-900">
            {contacts.toLocaleString()}
          </div>
          <Link href="/people" className="mt-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
            View all →
          </Link>
        </div>
        <div className="px-6 py-5">
          <div className="text-xs font-medium text-zinc-400">Messages sent</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-zinc-900">
            {totalMessages.toLocaleString()}
          </div>
          <Link href="/messages" className="mt-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
            View history →
          </Link>
        </div>
        <div className="px-6 py-5">
          <div className="text-xs font-medium text-zinc-400">Recipients reached</div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums text-zinc-900">
            {totalSent.toLocaleString()}
          </div>
          <Link href="/activity" className="mt-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
            View activity →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0 divide-x divide-zinc-100 px-0">
        {/* Recent messages — 2/3 width */}
        <div className="col-span-2 px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-900">Recent messages</h2>
            <Link href="/messages" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              View all
            </Link>
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-12 text-center">
              <p className="text-xs font-medium text-zinc-500">No messages yet</p>
              <Link href="/messages/new" className="mt-3 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
                Send your first message →
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-100 overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-zinc-50">
                  {messages.map((msg) => (
                    <tr key={msg.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-2">
                          <StatusDot status={msg.status} />
                          <span className="text-xs font-medium text-zinc-900 truncate max-w-[280px]">
                            {msg.subject ?? msg.body.slice(0, 50) + (msg.body.length > 50 ? "…" : "")}
                          </span>
                        </div>
                        <div className="mt-0.5 pl-4 text-[11px] text-zinc-400">{msg.audience_label}</div>
                      </td>
                      <td className="px-3 py-3">
                        <ChannelBadge channel={msg.channel} />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs tabular-nums text-zinc-500">
                          {(msg.sent_count ?? 0).toLocaleString()} sent
                        </span>
                      </td>
                      <td className="pl-3 pr-4 py-3 text-right">
                        <span className="text-[11px] tabular-nums text-zinc-400">
                          {formatRelative(msg.sent_at ?? msg.created_at)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent imports — 1/3 width */}
        <div className="px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-900">Recent imports</h2>
            <Link href="/imports" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
              View all
            </Link>
          </div>

          {imports.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-10 text-center">
              <p className="text-xs text-zinc-400">No imports yet</p>
              <Link href="/imports" className="mt-2 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
                Import contacts →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {imports.map((imp) => (
                <div
                  key={imp.id}
                  className="rounded-lg border border-zinc-100 px-3.5 py-3"
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span className="text-xs font-medium text-zinc-900 truncate">{imp.file_name}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">
                      {imp.imported_count.toLocaleString()} contacts
                    </span>
                    <span className="text-[11px] tabular-nums text-zinc-400">
                      {formatDate(imp.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              <Link
                href="/imports"
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-200 px-3.5 py-3 text-xs text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Import contacts
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
