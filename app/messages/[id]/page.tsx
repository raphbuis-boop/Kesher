export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
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
};

export type CampaignRecipient = {
  id: string;
  person_id: string;
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

  const bucket = (ts: string) =>
    Math.min(
      BUCKETS - 1,
      Math.max(0, Math.floor((new Date(ts).getTime() - start) / BUCKET_MS))
    );

  for (const r of recipients) {
    if (r.delivered_at) del[bucket(r.delivered_at)]++;
    if (r.opened_at)    open[bucket(r.opened_at)]++;
    if (r.read_at)      read[bucket(r.read_at)]++;
    if (r.replied_at)   replied[bucket(r.replied_at)]++;
  }

  let cd = 0, co = 0, cr = 0, cp = 0;
  return Array.from({ length: BUCKETS }, (_, i) => {
    cd += del[i];
    co += open[i];
    cr += read[i];
    cp += replied[i];
    return { hour: i, delivered: cd, opened: co, read: cr, replied: cp };
  });
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  const [msgRes, recRes] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, subject, body, channel, audience_label, audience_slug, recipient_count, sent_count, failed_count, status, sent_at, created_at"
      )
      .eq("org_id", orgId)
      .eq("id", id)
      .single(),
    supabase
      .from("message_recipients")
      .select(
        "id, person_id, contact_value, name, status, provider_id, sent_at, delivered_at, opened_at, clicked_at, read_at, replied_at, bounced_at, complained_at, bounce_type, people(id, first_name, last_name, categories)"
      )
      .eq("message_id", id)
      .order("name"),
  ]);

  if (msgRes.error || !msgRes.data) notFound();

  const message = msgRes.data as unknown as CampaignMessage;
  const recipients = (recRes.data ?? []) as unknown as CampaignRecipient[];
  const chartData = buildChartBuckets(
    recipients,
    message.sent_at ?? message.created_at
  );

  return (
    <CampaignClient
      message={message}
      recipients={recipients}
      chartData={chartData}
    />
  );
}
