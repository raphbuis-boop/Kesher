export const dynamic = "force-dynamic";

import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "sms") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        SMS
      </span>
    );
  }
  if (channel === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
      Email
    </span>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        Sent
      </span>
    );
  }
  if (status === "sending") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
        Sending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
      {status}
    </span>
  );
}

export default async function MessagesPage() {
  const { data } = await supabase
    .from("messages")
    .select(
      "id, subject, body, channel, audience_label, recipient_count, sent_count, failed_count, status, sent_at, created_at"
    )
    .order("created_at", { ascending: false });

  const messages = (data ?? []) as Message[];

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Messages</h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Email, SMS, and WhatsApp messages sent to your school community.
            </p>
          </div>
          <Link
            href="/messages/new"
            className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Compose Message
          </Link>
        </div>

        {messages.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-8 py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
              <svg
                className="h-6 w-6 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">
              No messages yet
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Send your first email to your school community.
            </p>
            <Link
              href="/messages/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Compose Message
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Message
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Channel
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Audience
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Sent
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {messages.map((msg) => (
                  <tr key={msg.id} className="group">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-zinc-900">
                        {msg.subject ?? msg.body.slice(0, 60) + (msg.body.length > 60 ? "…" : "")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <ChannelBadge channel={msg.channel ?? "email"} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-zinc-600">
                        {msg.audience_label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm tabular-nums text-zinc-600">
                        {msg.sent_count !== null
                          ? msg.sent_count.toLocaleString()
                          : msg.recipient_count.toLocaleString()}
                        {msg.failed_count !== null && msg.failed_count > 0 && (
                          <span className="ml-1 text-xs text-red-500">
                            ({msg.failed_count} failed)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={msg.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm tabular-nums text-zinc-400">
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
