import type { SupabaseClient } from "@supabase/supabase-js";

export const PEOPLE_PAGE_SIZE = 50;

export type PeopleSortKey = "name" | "created_at";
export type PeopleSortDir = "asc" | "desc";

export type PeopleQuery = {
  q: string;
  cat: string | null;
  sort: PeopleSortKey;
  dir: PeopleSortDir;
  page: number;
};

// Mirrors the category labels the People page shows, so searching
// "parents" or "board" still matches by category like before.
const CATEGORY_WORDS: Record<string, string[]> = {
  student: ["student", "students"],
  parent: ["parent", "parents"],
  faculty: ["faculty"],
  staff: ["staff"],
  alumni: ["alumni"],
  donor: ["donor", "donors"],
  grandparent: ["grandparent", "grandparents"],
  board: ["board"],
  prospect: ["prospect", "prospects"],
};

export function parsePeopleQuery(sp: Record<string, string | undefined>): PeopleQuery {
  const page = Number.parseInt(sp.page ?? "1", 10);
  return {
    q: (sp.q ?? "").trim().slice(0, 100),
    cat: sp.cat && sp.cat in CATEGORY_WORDS ? sp.cat : null,
    sort: sp.sort === "created_at" ? "created_at" : "name",
    dir: sp.dir === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Double-quotes a value for a PostgREST or() filter and drops characters that break its syntax. */
function orValue(term: string): string {
  return `"%${term.replace(/[,()"\\%*]/g, "")}%"`;
}

/**
 * One page of the People list, filtered, searched and sorted in the database
 * (org-scoped). Search matches every word against name, email, phone, grade,
 * tag names and category labels — same fields the client-side search used.
 */
export async function listPeople(
  supabase: SupabaseClient,
  orgId: string,
  tags: { id: string; name: string }[],
  query: PeopleQuery
) {
  const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);

  // Resolve tag-name matches to person ids up front (one query for all terms)
  const tagIdsByTerm = terms.map((t) => tags.filter((tag) => tag.name.toLowerCase().includes(t)).map((tag) => tag.id));
  const allTagIds = [...new Set(tagIdsByTerm.flat())];
  const personIdsByTag = new Map<string, string[]>();
  if (allTagIds.length > 0) {
    const { data } = await supabase.from("person_tags").select("person_id, tag_id").in("tag_id", allTagIds);
    for (const row of data ?? []) {
      const list = personIdsByTag.get(row.tag_id as string) ?? [];
      list.push(row.person_id as string);
      personIdsByTag.set(row.tag_id as string, list);
    }
  }

  let builder = supabase
    .from("people")
    .select(
      "id, first_name, last_name, email, phone, whatsapp, grade, categories, created_at, person_tags ( tag_id, tags ( id, name ) )",
      { count: "exact" }
    )
    .eq("org_id", orgId);

  if (query.cat) builder = builder.contains("categories", [query.cat]);

  terms.forEach((term, i) => {
    const v = orValue(term);
    const clauses = [
      `first_name.ilike.${v}`,
      `last_name.ilike.${v}`,
      `email.ilike.${v}`,
      `phone.ilike.${v}`,
      `grade.ilike.${v}`,
    ];
    for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
      if (words.some((w) => w.includes(term))) clauses.push(`categories.cs.{${cat}}`);
    }
    const tagPersonIds = [...new Set(tagIdsByTerm[i].flatMap((id) => personIdsByTag.get(id) ?? []))].slice(0, 500);
    if (tagPersonIds.length > 0) clauses.push(`id.in.(${tagPersonIds.join(",")})`);
    builder = builder.or(clauses.join(","));
  });

  const ascending = query.dir === "asc";
  builder =
    query.sort === "name"
      ? builder.order("last_name", { ascending }).order("first_name", { ascending })
      : builder.order("created_at", { ascending });

  const from = (query.page - 1) * PEOPLE_PAGE_SIZE;
  return builder.range(from, from + PEOPLE_PAGE_SIZE - 1);
}
