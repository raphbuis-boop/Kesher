export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMembership, isAdminRole } from "@/lib/org";
import { fetchAllRows } from "@/lib/supabase-paging";
import { guessTopGrade, schoolYearLabel } from "@/lib/rollover";
import { RolloverWizard, type RolloverRun } from "./RolloverWizard";

export default async function RolloverPage() {
  const { orgId, role } = await getMembership();
  const header = (
    <header className="sticky top-0 z-10 border-b border-line bg-card/95 px-6 py-3.5 backdrop-blur-sm">
      <Link href="/settings#data" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-3 hover:text-ink-2">
        <ArrowLeft size={13} /> Settings
      </Link>
      <h1 className="mt-1 text-[13px] font-semibold text-ink">New school year</h1>
      <p className="mt-px text-[11px] text-ink-3">Promote every student one grade and graduate the last grade — with a preview before anything changes.</p>
    </header>
  );
  if (!isAdminRole(role)) {
    return (
      <div className="min-h-screen bg-canvas">
        {header}
        <div className="px-6 py-8 text-[13px] text-ink-2">Only your school&apos;s owner or admins can run the year-end rollover.</div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [grades, runsRes] = await Promise.all([
    fetchAllRows<{ grade: string | null }>((from, to) =>
      supabase.from("people").select("grade").eq("org_id", orgId).eq("status", "active").contains("categories", ["student"]).order("id").range(from, to)
    ),
    supabase
      .from("rollover_runs")
      .select("id, school_year, top_grade, promoted_count, graduated_count, parents_archived, status, created_at, error")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="min-h-screen bg-canvas">
      {header}
      <div className="max-w-3xl px-6 py-6">
        <RolloverWizard
          suggestedTop={guessTopGrade(grades.map((g) => g.grade))}
          studentCount={grades.length}
          schoolYear={schoolYearLabel()}
          runs={(runsRes.data ?? []) as RolloverRun[]}
        />
      </div>
    </div>
  );
}
