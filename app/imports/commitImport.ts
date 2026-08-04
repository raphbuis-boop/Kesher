"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { revalidatePath } from "next/cache";

export type CommitRow = {
  salutation: string;
  first_name: string;
  last_name: string;
  preferred_name: string;
  email: string;
  phone: string;
  categories: string[];
  graduation_year: number | null;
  gender: "male" | "female" | "unknown";
  parent_role: "mom" | "dad" | null;
  notes: string;
  parent_of: string;
  address: string;
};

export type CommitResult = {
  imported: number;
  failed: number;
  error: string | null;
  // Diagnostic fields — first DB error message encountered, and table counts
  firstErrorMessage: string | null;
  countBefore: number;
  countAfter: number;
};

export async function commitImport(
  fileName: string,
  rows: CommitRow[]
): Promise<CommitResult> {
  const supabase = await createSupabaseServerClient();
  const orgId = await getOrgId();

  // ── Diagnostic: count before ──────────────────────────────────────────────
  const { count: countBefore } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  console.log(`[commitImport] START — file="${fileName}" rows_received=${rows.length} people_before=${countBefore ?? "error"}`);

  let imported = 0;
  let failed = 0;
  let firstErrorMessage: string | null = null;

  for (const row of rows) {
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();
    if (!firstName || !lastName) {
      console.warn(`[commitImport] SKIP no-name: "${row.first_name}" "${row.last_name}"`);
      failed++;
      continue;
    }

    const email = row.email?.trim() || null;
    const parentOf = row.parent_of?.trim() || null;

    const existingNotes = row.notes?.trim() || null;
    const notes = parentOf
      ? [`Parent of: ${parentOf}`, existingNotes].filter(Boolean).join("\n")
      : existingNotes || null;

    // Build payload WITHOUT address first — we'll add it only if the column exists
    const payload: Record<string, unknown> = {
      org_id: orgId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: row.phone?.trim() || null,
      salutation: row.salutation?.trim() || null,
      preferred_name: row.preferred_name?.trim() || null,
      gender: row.gender || "unknown",
      parent_role: row.parent_role || null,
      categories: row.categories.length > 0 ? row.categories : null,
      graduation_year: row.graduation_year || null,
      notes,
    };

    // Only include address if it has a value — avoids column-not-found errors
    // on schemas that don't have the address column yet
    const addressVal = row.address?.trim() || null;
    if (addressVal) payload.address = addressVal;

    let dbError: { message: string; code?: string } | null = null;

    if (email) {
      const { data: existing, error: lookupError } = await supabase
        .from("people")
        .select("id")
        .eq("org_id", orgId)
        .eq("email", email)
        .maybeSingle();

      if (lookupError) {
        console.error(`[commitImport] LOOKUP ERROR for ${email}:`, lookupError.message);
        dbError = lookupError;
      } else if (existing) {
        const { error: updateError } = await supabase
          .from("people")
          .update(payload)
          .eq("id", existing.id);
        dbError = updateError;
        if (!updateError) console.log(`[commitImport] UPDATED ${firstName} ${lastName} (${email})`);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("people")
          .insert(payload)
          .select("id")
          .single();
        dbError = insertError;
        if (!insertError) console.log(`[commitImport] INSERTED ${firstName} ${lastName} (${email}) id=${inserted?.id}`);
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("people")
        .insert(payload)
        .select("id")
        .single();
      dbError = insertError;
      if (!insertError) console.log(`[commitImport] INSERTED ${firstName} ${lastName} (no email) id=${inserted?.id}`);
    }

    if (dbError) {
      console.error(`[commitImport] FAILED ${firstName} ${lastName}: [${dbError.code}] ${dbError.message}`);
      console.error(`[commitImport] FAILED payload:`, JSON.stringify(payload));
      if (!firstErrorMessage) firstErrorMessage = `[${dbError.code}] ${dbError.message}`;
      failed++;
    } else {
      imported++;
    }
  }

  // ── Diagnostic: count after ───────────────────────────────────────────────
  const { count: countAfter } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  console.log(`[commitImport] END — imported=${imported} failed=${failed} people_after=${countAfter ?? "error"} first_error="${firstErrorMessage ?? "none"}"`);

  // Record in import_jobs
  await supabase.from("import_jobs").insert({
    org_id: orgId,
    file_name: fileName,
    status: "committed",
    row_count: rows.length,
    imported_count: imported,
    failed_count: failed,
  });

  // Record in legacy imports table — best-effort
  try {
    await supabase
      .from("imports")
      .insert({ org_id: orgId, file_name: fileName, imported_count: imported, failed_count: failed });
  } catch { /* best-effort */ }

  revalidatePath("/people");
  revalidatePath("/imports");
  revalidatePath("/");

  return {
    imported,
    failed,
    error: firstErrorMessage,   // surfaces the DB error to the UI
    firstErrorMessage,
    countBefore: countBefore ?? -1,
    countAfter: countAfter ?? -1,
  };
}
