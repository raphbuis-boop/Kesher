export const dynamic = "force-dynamic";

import Link from "next/link";
import { Inbox as InboxIcon, MessageSquare, Smartphone } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership } from "@/lib/org";
import { whatsappWindow } from "@/lib/inbox";
import { getSchoolTimezone, formatInZone } from "@/lib/schoolTime";
import { ThreadPanel, type ThreadMessage, type ThreadView, type Teammate } from "./ThreadPanel";

type ThreadRow = {
  id: string;
  person_id: string | null;
  display_name: string | null;
  address: string | null;
  channel: string;
  last_inbound_channel: string | null;
  last_preview: string | null;
  last_message_at: string | null;
  last_whatsapp_inbound_at: string | null;
  unread_count: number;
  status: "open" | "done";
  assigned_to: string | null;
};

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
  { key: "done", label: "Done" },
] as const;

function ago(ts: string | null) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d` : new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ filter?: string; thread?: string }> }) {
  const { filter: filterParam, thread: threadId } = await searchParams;
  const filter = FILTERS.some((f) => f.key === filterParam) ? (filterParam as (typeof FILTERS)[number]["key"]) : "open";
  const supabase = await createSupabaseServerClient();
  const { orgId, userId } = await getMembership();

  const cols = "id, person_id, display_name, address, channel, last_inbound_channel, last_preview, last_message_at, last_whatsapp_inbound_at, unread_count, status, assigned_to";
  const base = () => supabase.from("message_threads").select(cols, { count: "exact" }).eq("org_id", orgId);
  const apply = (q: ReturnType<typeof base>, f: string) =>
    f === "done" ? q.eq("status", "done") : f === "mine" ? q.eq("status", "open").eq("assigned_to", userId) : f === "unassigned" ? q.eq("status", "open").is("assigned_to", null) : q.eq("status", "open");

  const [listRes, ...counts] = await Promise.all([
    apply(base(), filter).order("last_message_at", { ascending: false, nullsFirst: false }).limit(100),
    ...FILTERS.map((f) => apply(supabase.from("message_threads").select("id", { count: "exact", head: true }).eq("org_id", orgId) as unknown as ReturnType<typeof base>, f.key)),
  ]);
  const threads = (listRes.data ?? []) as unknown as ThreadRow[];
  const countByKey = Object.fromEntries(FILTERS.map((f, i) => [f.key, counts[i].count ?? 0]));

  // The conversation on the right
  let view: ThreadView | null = null;
  const selected = threadId ? ((await base().eq("id", threadId).maybeSingle()).data as unknown as ThreadRow | null) : null;
  if (selected) {
    const [{ data: msgs }, { data: person }, membersRes, timezone] = await Promise.all([
      supabase.from("thread_messages").select("id, direction, channel, body, status, kind, sent_at, created_at, reply_to_recipient_id, error_detail, sent_by").eq("org_id", orgId).eq("thread_id", selected.id).order("created_at", { ascending: true }).limit(300),
      selected.person_id ? supabase.from("people").select("id, first_name, last_name, phone, whatsapp, email").eq("org_id", orgId).eq("id", selected.person_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.rpc("org_members", { p_org: orgId }),
      getSchoolTimezone(supabase, orgId),
    ]);
    const rows = (msgs ?? []) as { id: string; direction: "inbound" | "outbound"; channel: string | null; body: string | null; status: string | null; kind: string; sent_at: string | null; created_at: string; reply_to_recipient_id: string | null; error_detail: string | null; sent_by: string | null }[];

    // The message each reply answers
    const replyIds = [...new Set(rows.map((r) => r.reply_to_recipient_id).filter((x): x is string => !!x))];
    const replyMap = new Map<string, { id: string; title: string; sentAt: string | null }>();
    if (replyIds.length) {
      const { data: recips } = await supabase.from("message_recipients").select("id, sent_at, messages!inner(id, org_id, subject, body)").eq("messages.org_id", orgId).in("id", replyIds);
      for (const r of (recips ?? []) as unknown as { id: string; sent_at: string | null; messages: { id: string; subject: string | null; body: string } }[]) {
        replyMap.set(r.id, { id: r.messages.id, title: r.messages.subject?.trim() || r.messages.body.replace(/\s+/g, " ").slice(0, 70), sentAt: r.sent_at });
      }
    }
    const members = ((membersRes.data ?? []) as { user_id: string; email: string; full_name: string }[]).map((m): Teammate => ({ id: m.user_id, name: m.full_name || m.email }));
    const nameOf = new Map(members.map((m) => [m.id, m.name]));
    const wa = whatsappWindow(selected.last_whatsapp_inbound_at);
    const p = person as { id: string; first_name: string; last_name: string; phone: string | null; whatsapp: string | null; email: string | null } | null;

    view = {
      id: selected.id,
      name: selected.display_name || (p ? `${p.first_name} ${p.last_name}`.trim() : selected.address) || "Unknown number",
      personId: selected.person_id,
      address: selected.address,
      status: selected.status,
      assignedTo: selected.assigned_to,
      unread: selected.unread_count,
      lastChannel: selected.last_inbound_channel === "whatsapp" || selected.channel === "whatsapp" ? "whatsapp" : "sms",
      canSms: !!(p?.phone || selected.address),
      canWhatsapp: !!(p?.whatsapp || p?.phone || selected.address),
      whatsappOpen: wa.open,
      whatsappUntil: wa.until ? formatInZone(wa.until, timezone) : null,
      teammates: members,
      messages: rows.map((r): ThreadMessage => ({
        id: r.id,
        direction: r.direction,
        channel: r.channel === "whatsapp" ? "whatsapp" : "sms",
        body: r.body ?? "",
        status: r.status,
        kind: r.kind as ThreadMessage["kind"],
        at: r.sent_at ?? r.created_at,
        atLabel: formatInZone(r.sent_at ?? r.created_at, timezone),
        repliedTo: r.reply_to_recipient_id ? (replyMap.get(r.reply_to_recipient_id) ?? null) : null,
        error: r.error_detail,
        sender: r.sent_by ? (nameOf.get(r.sent_by) ?? "Staff") : null,
      })),
    };
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="px-6 py-3.5">
          <h1 className="text-[13px] font-semibold text-ink">Inbox</h1>
          <p className="mt-px text-[11px] text-ink-3">Replies from parents by text and WhatsApp.</p>
        </div>
        <div role="tablist" className="flex gap-4 px-6">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              href={`/inbox?filter=${f.key}`}
              className={`border-b-[1.5px] pb-2.5 text-[12px] font-medium ${filter === f.key ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}
            >
              {f.label} <span className="tabular-nums text-ink-3">{countByKey[f.key]}</span>
            </Link>
          ))}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 md:grid-cols-[minmax(280px,360px)_1fr]">
        <div className={`border-r border-line bg-card ${view ? "hidden md:block" : ""}`}>
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <InboxIcon size={18} className="mb-3 text-line-strong" />
              <p className="text-[13px] font-semibold text-ink">{filter === "done" ? "Nothing finished yet" : "No conversations"}</p>
              <p className="mt-1 text-[12px] text-ink-3">When a parent replies to a text or WhatsApp message, it shows up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-muted">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link href={`/inbox?filter=${filter}&thread=${t.id}`} className={`block px-4 py-3 hover:bg-canvas ${t.id === threadId ? "bg-canvas" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span dir="auto" className={`truncate text-[13px] ${t.unread_count > 0 ? "font-semibold text-ink" : "font-medium text-ink-soft"}`}>{t.display_name || t.address || "Unknown number"}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-ink-3">{ago(t.last_message_at)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      {(t.last_inbound_channel ?? t.channel) === "whatsapp" ? <MessageSquare size={11} className="shrink-0 text-emerald-500" /> : <Smartphone size={11} className="shrink-0 text-blue-500" />}
                      <p dir="auto" className={`truncate text-[12px] ${t.unread_count > 0 ? "text-ink" : "text-ink-3"}`}>{t.last_preview}</p>
                      {t.unread_count > 0 && <span className="ml-auto shrink-0 rounded-full bg-brand px-1.5 text-[10px] font-semibold text-on-ink">{t.unread_count}</span>}
                    </div>
                    {t.assigned_to && t.assigned_to === userId && <p className="mt-0.5 text-[10px] text-ink-3">Assigned to you</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={view ? "" : "hidden md:block"}>
          {view ? (
            <ThreadPanel key={view.id} view={view} currentUserId={userId} backHref={`/inbox?filter=${filter}`} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 py-24 text-center">
              <MessageSquare size={18} className="mb-3 text-line-strong" />
              <p className="text-[13px] text-ink-3">Choose a conversation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
