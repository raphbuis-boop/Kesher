import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";

/**
 * GET /api/export/contacts — every contact in the caller's org as CSV.
 * Signed-in only (proxy.ts), org-scoped by org_id and RLS; pages through
 * PostgREST's 1,000-row limit.
 */
export async function GET() {
  let orgId: string;
  try {
    orgId = await getOrgId();
  } catch {
    return new Response("Not signed in", { status: 401 });
  }
  const supabase = await createSupabaseServerClient();

  type Row = {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    grade: string | null;
    categories: string[] | null;
    created_at: string;
    person_tags: Array<{ tags: { name: string } | null }>;
  };

  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("people")
      .select("first_name, last_name, email, phone, whatsapp, grade, categories, created_at, person_tags ( tags ( name ) )")
      .eq("org_id", orgId)
      .order("last_name")
      .order("id")
      .range(from, from + 999);
    if (error) return new Response(`Export failed: ${error.message}`, { status: 500 });
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const cell = (v: string | null | undefined) => {
    const s = v ?? "";
    // Quote, and neutralise spreadsheet formula injection
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ["First name", "Last name", "Email", "Phone", "WhatsApp", "Grade", "Audiences", "Tags", "Added"];
  const lines = rows.map((p) =>
    [
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.whatsapp,
      p.grade,
      (p.categories ?? []).join(", "),
      p.person_tags.map((pt) => pt.tags?.name).filter(Boolean).join(", "),
      p.created_at.slice(0, 10),
    ]
      .map(cell)
      .join(",")
  );

  const date = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + [header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kesher-contacts-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
