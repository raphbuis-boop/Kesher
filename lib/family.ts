import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Family model (see scripts/migrate_p1_1_family_model.sql):
 *   households → people (guardians and students are both people) →
 *   guardian_students links carrying custodial / receives_messages.
 */

export type PersonStatus = "active" | "pending" | "archived" | "rejected";

export const RELATIONSHIPS = ["mother", "father", "parent", "guardian", "grandparent", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<string, string> = {
  mother: "Mother",
  father: "Father",
  parent: "Parent",
  guardian: "Guardian",
  grandparent: "Grandparent",
  other: "Other",
};

export type FamilyLink = {
  id: string;
  relationship: string;
  custodial: boolean;
  receives_messages: boolean;
  source_system: string;
  person: { id: string; first_name: string; last_name: string; grade: string | null; status: PersonStatus };
};

export type Household = {
  id: string;
  name: string;
  address: string | null;
  source_system: string;
  source_id: string | null;
  members: { id: string; first_name: string; last_name: string; categories: string[] | null }[];
};

export type Family = {
  household: Household | null;
  /** Links where this person is the student (their guardians). */
  guardians: FamilyLink[];
  /** Links where this person is the guardian (their students). */
  students: FamilyLink[];
};

const LINK_PERSON = "id, first_name, last_name, grade, status";

/** Everything the person page shows about a person's family. Org-scoped. */
export async function getFamily(
  supabase: SupabaseClient,
  orgId: string,
  personId: string,
  householdId: string | null
): Promise<Family> {
  const [householdRes, membersRes, guardianRes, studentRes] = await Promise.all([
    householdId
      ? supabase
          .from("households")
          .select("id, name, address, source_system, source_id")
          .eq("org_id", orgId)
          .eq("id", householdId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    householdId
      ? supabase
          .from("people")
          .select("id, first_name, last_name, categories")
          .eq("org_id", orgId)
          .eq("household_id", householdId)
          .eq("status", "active")
          .neq("id", personId)
          .order("first_name")
      : Promise.resolve({ data: [] }),
    supabase
      .from("guardian_students")
      .select(`id, relationship, custodial, receives_messages, source_system, person:people!guardian_students_guardian_id_fkey ( ${LINK_PERSON} )`)
      .eq("org_id", orgId)
      .eq("student_id", personId),
    supabase
      .from("guardian_students")
      .select(`id, relationship, custodial, receives_messages, source_system, person:people!guardian_students_student_id_fkey ( ${LINK_PERSON} )`)
      .eq("org_id", orgId)
      .eq("guardian_id", personId),
  ]);

  const household = householdRes.data
    ? ({ ...(householdRes.data as Omit<Household, "members">), members: (membersRes.data ?? []) as Household["members"] } as Household)
    : null;

  const clean = (rows: unknown[] | null) =>
    ((rows ?? []) as FamilyLink[]).filter((l) => l.person && l.person.status !== "rejected");

  return {
    household,
    guardians: clean(guardianRes.data),
    students: clean(studentRes.data),
  };
}

/** "Moshe (3rd) and Rivka (6th)" — used for the per-parent message prefix. */
export function childrenLabel(children: { first_name: string; grade: string | null }[]): string {
  const parts = children.map((c) => (c.grade ? `${c.first_name} (${ordinalGrade(c.grade)})` : c.first_name));
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "3" → "3rd", "K" → "K", "Pre-K" → "Pre-K". */
export function ordinalGrade(grade: string): string {
  const n = Number.parseInt(grade, 10);
  if (!Number.isFinite(n) || String(n) !== grade.trim()) return grade.trim();
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** Where a synced record came from, for badges ("Google Sheet", "CSV import"…). */
export const SOURCE_LABELS: Record<string, string> = {
  manual: "Added in Kesher",
  csv: "File import",
  google_sheets: "Google Sheet",
  facts: "FACTS",
  veracross: "Veracross",
  blackbaud: "Blackbaud",
  signup: "Parent signup",
};
