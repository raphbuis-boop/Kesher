export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { findContactGaps, findDeliveryFailures, GAP_LABELS, type ContactGap } from "@/lib/contactGaps";

const LIMIT = 100;
const CHANNEL_LABEL: Record<string, string> = { email: "Email", sms: "Text", whatsapp: "WhatsApp", multi: "Message" };

function when(ts: string | null) {
  return ts ? new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

export default async function DeliveryProblemsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();
  const [failures, gaps] = await Promise.all([findDeliveryFailures(supabase, orgId, { messageId: message }), message ? Promise.resolve([] as ContactGap[]) : findContactGaps(supabase, orgId)]);

  const byReason = new Map<ContactGap["reason"], ContactGap[]>();
  for (const g of gaps) byReason.set(g.reason, [...(byReason.get(g.reason) ?? []), g]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 px-6 py-3.5 backdrop-blur-sm">
        <Link href="/messages" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2">
          <ArrowLeft size={13} strokeWidth={2} /> Messages
        </Link>
        <h1 className="mt-1 text-[13px] font-semibold text-ink">Delivery problems</h1>
        <p className="mt-px text-[11px] text-ink-3">Messages that didn&apos;t arrive, and families Kesher can&apos;t reach. Fix the contact info and the next message gets through.</p>
      </header>

      <div className="max-w-4xl space-y-6 px-6 py-6">
        <section className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
          <div className="flex items-baseline justify-between border-b border-muted-2 bg-canvas px-5 py-3">
            <h2 className="text-[12px] font-semibold text-ink">Didn&apos;t arrive{message ? " (this message)" : " (last 60 days)"}</h2>
            <span className="text-[11px] tabular-nums text-ink-3">{failures.length.toLocaleString()}</span>
          </div>
          {failures.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-ink-3">Nothing failed. Every message that was sent reached the provider and wasn&apos;t rejected.</p>
          ) : (
            <ul className="divide-y divide-muted">
              {failures.slice(0, LIMIT).map((f) => (
                <li key={f.rowId} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/people/${f.personId}`} dir="auto" className="text-[13px] font-medium text-ink hover:underline">{f.name}</Link>
                    <p className="mt-0.5 text-[11px] text-ink-3">
                      {CHANNEL_LABEL[f.channel] ?? f.channel} · <span className="font-mono">{f.contact}</span>
                    </p>
                    <p className="mt-0.5 text-[12px] text-red-600">{f.reason}</p>
                  </div>
                  <div className="text-right text-[11px] text-ink-3">
                    <Link href={`/messages/${f.messageId}`} dir="auto" className="block max-w-[220px] truncate hover:text-ink-2 hover:underline">{f.messageTitle}</Link>
                    {when(f.at)}
                  </div>
                </li>
              ))}
              {failures.length > LIMIT && <li className="px-5 py-3 text-[12px] text-ink-3">…and {(failures.length - LIMIT).toLocaleString()} more</li>}
            </ul>
          )}
        </section>

        {!message && (
          <section className="overflow-hidden rounded-xl border border-line bg-card shadow-card">
            <div className="flex items-baseline justify-between border-b border-muted-2 bg-canvas px-5 py-3">
              <h2 className="text-[12px] font-semibold text-ink">Families Kesher can&apos;t reach</h2>
              <span className="text-[11px] tabular-nums text-ink-3">{gaps.length.toLocaleString()}</span>
            </div>
            {gaps.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-ink-3">Everyone in your directory has working contact info.</p>
            ) : (
              [...byReason.entries()].map(([reason, list]) => (
                <details key={reason} className="group border-b border-muted last:border-0" open={list.length <= 8}>
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-[13px] font-medium text-ink hover:bg-canvas">
                    {GAP_LABELS[reason]}
                    <span className="text-[11px] font-normal tabular-nums text-ink-3">{list.length.toLocaleString()}</span>
                  </summary>
                  <ul className="divide-y divide-muted border-t border-muted bg-canvas/50">
                    {list.slice(0, LIMIT).map((g) => (
                      <li key={`${g.personId}-${reason}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
                        <div className="min-w-0">
                          <Link href={`/people/${g.personId}`} dir="auto" className="text-[13px] text-ink hover:underline">{g.name}</Link>
                          <p className="truncate text-[11px] text-ink-3">{g.detail}</p>
                        </div>
                        <Link href={`/people/${g.personId}`} className="btn btn-secondary btn-sm shrink-0">Fix</Link>
                      </li>
                    ))}
                    {list.length > LIMIT && <li className="px-5 py-2.5 text-[12px] text-ink-3">…and {(list.length - LIMIT).toLocaleString()} more</li>}
                  </ul>
                </details>
              ))
            )}
          </section>
        )}
      </div>
    </div>
  );
}
