"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type ParsedRow = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  graduation_year: string;
  tags: string;
};

export type ImportActionState = {
  status: "idle" | "success" | "error";
  imported: number;
  failed: number;
  error: string | null;
};

export async function importPeople(
  _prevState: ImportActionState,
  formData: FormData
): Promise<ImportActionState> {
  const supabase = await createSupabaseServerClient();
  const fileName =
    (formData.get("file_name") as string | null)?.trim() || "import.csv";
  const rowsJson = formData.get("rows") as string | null;

  if (!rowsJson) {
    return { status: "error", imported: 0, failed: 0, error: "No data received." };
  }

  let rows: ParsedRow[];
  try {
    rows = JSON.parse(rowsJson) as ParsedRow[];
  } catch {
    return { status: "error", imported: 0, failed: 0, error: "Could not parse row data." };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: "error", imported: 0, failed: 0, error: "No rows to import." };
  }

  // Fetch all existing tags once for tag name → id resolution
  const { data: allTags } = await supabase.from("tags").select("id, name");
  const tagsByName = new Map(
    (allTags ?? []).map((t) => [t.name.toLowerCase().trim(), t.id as string])
  );

  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    const firstName = row.first_name?.trim();
    const lastName = row.last_name?.trim();

    // Skip rows that are missing required fields
    if (!firstName || !lastName) {
      failed++;
      continue;
    }

    const email = row.email?.trim() || null;
    const phone = row.phone?.trim() || null;
    const gradYearRaw = row.graduation_year?.trim();
    const gradYearNum = gradYearRaw ? parseInt(gradYearRaw, 10) : null;
    const graduation_year =
      gradYearNum !== null && !isNaN(gradYearNum) ? gradYearNum : null;

    const { data: person, error: insertError } = await supabase
      .from("people")
      .insert({ first_name: firstName, last_name: lastName, email, phone, graduation_year })
      .select("id")
      .single();

    if (insertError || !person) {
      failed++;
      continue;
    }

    // Resolve and insert tags (best-effort — never fail the row over tags)
    const rawTags = row.tags?.trim();
    if (rawTags) {
      const tagIds = rawTags
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((name) => tagsByName.get(name.toLowerCase()))
        .filter((id): id is string => Boolean(id));

      if (tagIds.length > 0) {
        await supabase
          .from("person_tags")
          .insert(tagIds.map((tag_id) => ({ person_id: person.id, tag_id })));
      }
    }

    imported++;
  }

  // Record in import history
  await supabase.from("imports").insert({
    file_name: fileName,
    imported_count: imported,
    failed_count: failed,
  });

  revalidatePath("/people");
  revalidatePath("/imports");

  return { status: "success", imported, failed, error: null };
}
