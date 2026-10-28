export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { CampaignClient } from "./CampaignClient";

export type CampaignMessage = {
  id: string;
  subject: string | null;
  body: string;
  channel: string;
  audience_label: string;
  audience_slug: string;
  recipient_count: number;
  sent_count: number | null;
  failed_count: number | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  resend_of: string | null;
  /** "true" when the message carried an "I've read this" link */
  confirm_button: string | null;
};

/** Context shown above the numbers: what this message is a reminder for, and reminders already sent for it */
export type CampaignLinks = {
  reminderFor: { id: string; title: string } | null;
  reminders: number;
  /** Unsent-roster problems (people with no usable contact) are listed on the delivery problems page */
  isAdmin: boolean;
};

export type CampaignRecipient = {
  id: string;
  person_id: string;
  channel: string | null;
  confirmed_at: string | null;
  fallback_of: string | null;
  contact_value: string;
  name: string;
  status: string;
  provider_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  bounce_type: string | null;
  error_detail: string | null;
  people: {
    id: string;
    first_name: string;
    last_name: string;
    categories: string[] | null;
  } | null;
};

export type ChartBucket = {
  hour: number;
  delivered: number;
  opened: number;   // email
  read: number;     // whatsapp
  replied: number;  // sms + whatsapp
  confirmed: number; // "I've read this"
};

function buildChartBuckets(
  recipients: CampaignRecipient[],
  sentAt: string
): ChartBucket[] {
  const start = new Date(sentAt).getTime();
  const BUCKETS = 24;
  const BUCKET_MS = 3_600_000;

  const del     = new Array(BUCKETS).fill(0);
  const open    = new Array(BUCKETS).fill(0);
  const read    = new Array(BUCKETS).fill(0);
  const replied = new Array(BUCKETS).fill(0);
  const confirmed = new Array(BUCKETS).fill(0);

  const bucket = (ts: string) =>
    Math.min(
      BUCKETS - 1,
      Math.max(0, Math.floor((new Date(ts).getTime() - start) / BUCKET_MS))
    );

  for (const r of recipients) {
    if (r.delivered_at) del[bucket(r.delivered_at)]++;
    if (r.opened_at)    open[bucket(r.opened_at)]++;
    if (r.confirmed_at) confirmed[bucket(r.confirmed_at)]++;
    if (r.read_at)      read[bucket(r.read_at)]++;
    if (r.replied_at)   replied[bucket(r.replied_at)]++;
  }

  let cd = 0, co = 0, cr = 0, cp = 0, cc = 0;
  return Array.from({ length: BUCKETS }, (_, i) => {
    cd += del[i];
    co += open[i];
    cr += read[i];
    cp += replied[i];
    cc += confirmed[i];
    return { hour: i, delivered: cd, opened: co, read: cr, replied: cp, confirmed: cc };
  });
}

const RECIPIENT_CHUNK = 1000;

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { orgId, role } = await getMembership();

  const recipientColumns =
    "id, person_id, channel, confirmed_at, fallback_of, contact_value, name, status, provider_id, sent_at, delivered_at, opened_at, clicked_at, read_at, replied_at, bounced_at, complained_at, bounce_type, error_detail, people(id, first_name, last_name, categories)";
  const recipientPage = (from: number) =>
    supabase
      .from("message_recipients")
      .select(recipientColumns, { count: from === 0 ? "exact" : undefined })
      .eq("message_id", id)
      .order("name")
      .order("id")
      .range(from, from + RECIPIENT_CHUNK - 1);

  const [msgRes, firstRecipients] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, subject, body, channel, audience_label, audience_slug, recipient_count, sent_count, failed_count, status, sent_at, created_at, resend_of, confirm_button:payload->>confirmButton"
      )
      .eq("org_id", orgId)
      .eq("id", id)
      .single(),
    recipientPage(0),
  ]);

  // Stats and the delivery chart need every recipient. PostgREST returns at
  // most 1,000 rows per request, so fetch any remaining chunks in parallel
  // (previously campaigns over 1,000 recipients were silently truncated).
  const totalRecipients = firstRecipients.count ?? 0;
  const restStarts: number[] = [];
  for (let from = RECIPIENT_CHUNK; from < totalRecipients; from += RECIPIENT_CHUNK) restStarts.push(from);
  const rest = await Promise.all(restStarts.map((from) => recipientPage(from)));
  const recRes = { data: [firstRecipients, ...rest].flatMap((r) => r.data ?? []) };

  if (msgRes.error || !msgRes.data) notFound();
  // Not sent yet: there are no results to show, so open it for editing instead
  if (["draft", "pending_approval", "scheduled", "rejected", "cancelled"].includes((msgRes.data as { status: string }).status)) redirect(`/messages/new?edit=${id}`);

  const message = msgRes.data as unknown as CampaignMessage;
  const recipients = (recRes.data ?? []) as unknown as CampaignRecipient[];
  const chartData = buildChartBuckets(
    recipients,
    message.sent_at ?? message.created_at
  );

  const [reminderRes, remindersRes] = await Promise.all([
    message.resend_of
      ? supabase.from("messages").select("id, subject, body").eq("org_id", orgId).eq("id", message.resend_of).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("resend_of", id),
  ]);
  const original = reminderRes.data as { id: string; subject: string | null; body: string } | null;
  const links: CampaignLinks = {
    reminderFor: original ? { id: original.id, title: original.subject?.trim() || original.body.slice(0, 50) } : null,
    reminders: remindersRes.count ?? 0,
    isAdmin: isAdminRole(role),
  };

  return (
    <CampaignClient
      message={message}
      recipients={recipients}
      chartData={chartData}
      links={links}
    />
  );
}
