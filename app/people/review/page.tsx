export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { SOURCE_LABELS } from "@/lib/family";
import { ReviewQueue, type ReviewPerson } from "./ReviewQueue";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  categories: string[] | null;
  grade: string | null;
  source_system: string;
  created_at: string;
  households: { name: string } | null;
  sync_sources: { name: string } | null;
};

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const showRejected = tab === "rejected";
  const supabase = await createSupabaseServerClient();
  const { orgId, role } = await getMembership();

  const [{ data }, { count: pendingCount }, { count: rejectedCount }] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name, email, phone, categories, grade, source_system, created_at, households ( name ), sync_sources ( name )")
      .eq("org_id", orgId)
      .eq("status", showRejected ? "rejected" : "pending")
      .order("household_id", { nullsFirst: false })
      .order("last_name")
      .limit(1000),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "pending"),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "rejected"),
  ]);
  const rows = (data ?? []) as unknown as Row[];

  // Possible matches with people already in the directory (same email, or same name)
  const emails = [...new Set(rows.map((r) => r.email?.toLowerCase()).filter((e): e is string => !!e))];
  const lastNames = [...new Set(rows.map((r) => r.last_name).filter(Boolean))];
  const [byEmail, byName] = await Promise.all([
    emails.length
      ? supabase.from("people").select("id, first_name, last_name, email").eq("org_id", orgId).eq("status", "active").in("email", emails.slice(0, 300))
      : Promise.resolve({ data: [] }),
    lastNames.length
      ? supabase.from("people").select("id, first_name, last_name, email").eq("org_id", orgId).eq("status", "active").in("last_name", lastNames.slice(0, 300))
      : Promise.resolve({ data: [] }),
  ]);
  type Match = { id: string; first_name: string; last_name: string; email: string | null };
  const active = [...((byEmail.data ?? []) as Match[]), ...((byName.data ?? []) as Match[])];

  const people: ReviewPerson[] = rows.map((r) => {
    const match = active.find(
      (a) =>
        (r.email && a.email?.toLowerCase() === r.email.toLowerCase()) ||
        (`${a.first_name} ${a.last_name}`.toLowerCase() === `${r.first_name} ${r.last_name}`.toLowerCase())
    );
    return {
      id: r.id,
      name: `${r.first_name} ${r.last_name}`.trim() || "(no name)",
      detail: [r.categories?.includes("student") ? `Student${r.grade ? `, grade ${r.grade}` : ""}` : r.categories?.includes("parent") ? "Parent" : null, r.email, r.phone]
        .filter(Boolean)
        .join(" · "),
      family: r.households?.name ?? "No family",
      source: r.sync_sources?.name ?? SOURCE_LABELS[r.source_system] ?? r.source_system,
      match: match ? { id: match.id, name: `${match.first_name} ${match.last_name}` } : null,
    };
  });

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur-sm">
        <div className="px-6 py-3.5">
          <Link href="/people" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2">
            <ArrowLeft size={13} /> People
          </Link>
          <h1 className="mt-1 text-[13px] font-semibold text-ink">Review new contacts</h1>
          <p className="mt-px text-[11px] text-ink-3">
            New people from your school&apos;s lists and parent signups wait here. Nobody gets messages until approved.
          </p>
        </div>
        <div className="flex gap-4 px-6">
          {[
            { key: "pending", label: "Waiting", count: pendingCount ?? 0, href: "/people/review" },
            { key: "rejected", label: "Rejected", count: rejectedCount ?? 0, href: "/people/review?tab=rejected" },
          ].map((t) => {
            const active = (t.key === "rejected") === showRejected;
            return (
              <Link
                key={t.key}
                href={t.href}
                className={`border-b-[1.5px] pb-2.5 text-[12px] font-medium ${active ? "border-ink text-ink" : "border-transparent text-ink-3 hover:text-ink-2"}`}
              >
                {t.label} <span className="tabular-nums text-ink-3">{t.count}</span>
              </Link>
            );
          })}
        </div>
      </header>
      <div className="max-w-4xl px-6 py-5">
        <ReviewQueue people={people} canReview={isAdminRole(role)} rejected={showRejected} />
      </div>
    </div>
  );
}
