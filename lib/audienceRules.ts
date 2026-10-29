/**
 * Smart audience rules — saved in groups.filter_config and evaluated at send
 * time, so membership is always current. Client-safe (no server imports):
 * used by the rule builder in the browser and by the server evaluator in
 * lib/resolveAudience.ts.
 *
 *   { type: "and" | "or", filters: [...] }
 *   { type: "field", field, op, value }       — any person field or custom field
 *   { type: "category" | "grad_year_eq" | "grad_year_range" }   — older rules, still evaluated
 */

import { gradeRank, sameGrade } from "./grades";

export type FieldOp = "eq" | "neq" | "gte" | "lte" | "contains" | "empty" | "not_empty";

export type FilterNode =
  | { type: "and"; filters: FilterNode[] }
  | { type: "or"; filters: FilterNode[] }
  | { type: "field"; field: string; op: FieldOp; value?: string | number }
  | { type: "category"; value: string }
  | { type: "grad_year_eq"; value: number }
  | { type: "grad_year_range"; min: number; max: number };

export const ROLE_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
  { value: "grandparent", label: "Grandparent" },
  { value: "faculty", label: "Faculty" },
  { value: "staff", label: "Staff" },
  { value: "board", label: "Board" },
  { value: "alumni", label: "Alumni" },
  { value: "donor", label: "Donor" },
  { value: "prospect", label: "Prospect" },
];

export type RuleCatalog = {
  customFields: { key: string; label: string; field_type: "text" | "number" | "select"; options: string[] }[];
  tags: { id: string; name: string }[];
};

export type FieldKind = "role" | "grade" | "number" | "text" | "select" | "tag" | "contact";

export type FieldChoice = { field: string; label: string; kind: FieldKind; options?: string[] };

/** Everything a rule can filter on, for the builder's first dropdown. */
export function fieldChoices(catalog: RuleCatalog): FieldChoice[] {
  return [
    { field: "role", label: "Role (parent, student…)", kind: "role" },
    { field: "grade", label: "Grade", kind: "grade" },
    { field: "graduation_year", label: "Graduation year", kind: "number" },
    ...catalog.customFields.map<FieldChoice>((f) => ({
      field: `custom:${f.key}`,
      label: f.label,
      kind: f.field_type === "select" ? "select" : f.field_type === "number" ? "number" : "text",
      options: f.options,
    })),
    ...(catalog.tags.length > 0 ? [{ field: "tag", label: "Tag", kind: "tag" as const }] : []),
    { field: "email", label: "Email address", kind: "contact" },
    { field: "phone", label: "Phone number", kind: "contact" },
    { field: "whatsapp", label: "WhatsApp number", kind: "contact" },
  ];
}

export const OPS_BY_KIND: Record<FieldKind, { op: FieldOp; label: string }[]> = {
  role: [{ op: "eq", label: "is" }, { op: "neq", label: "is not" }],
  grade: [{ op: "eq", label: "is" }, { op: "neq", label: "is not" }, { op: "gte", label: "is at least" }, { op: "lte", label: "is at most" }],
  number: [{ op: "eq", label: "is" }, { op: "neq", label: "is not" }, { op: "gte", label: "is at least" }, { op: "lte", label: "is at most" }, { op: "not_empty", label: "is set" }, { op: "empty", label: "is empty" }],
  text: [{ op: "eq", label: "is" }, { op: "neq", label: "is not" }, { op: "contains", label: "contains" }, { op: "not_empty", label: "is set" }, { op: "empty", label: "is empty" }],
  select: [{ op: "eq", label: "is" }, { op: "neq", label: "is not" }, { op: "not_empty", label: "is set" }, { op: "empty", label: "is empty" }],
  tag: [{ op: "eq", label: "has" }, { op: "neq", label: "doesn't have" }],
  contact: [{ op: "not_empty", label: "is on file" }, { op: "empty", label: "is missing" }],
};

// ─── Flat condition list ⇄ rule tree (what the builder edits) ────────────────

export type Condition = { id: string; field: string; op: FieldOp; value: string };

let counter = 0;
export const newConditionId = () => `c${Date.now().toString(36)}${(counter++).toString(36)}`;

export function conditionsToNode(conditions: Condition[], combinator: "and" | "or"): FilterNode | null {
  const leaves: FilterNode[] = conditions
    .filter((c) => c.op === "empty" || c.op === "not_empty" || c.value.trim() !== "")
    .map((c) => ({
      type: "field",
      field: c.field,
      op: c.op,
      ...(c.op === "empty" || c.op === "not_empty" ? {} : { value: isNumericField(c.field) && c.value.trim() !== "" && !Number.isNaN(Number(c.value)) ? Number(c.value) : c.value.trim() }),
    }));
  if (leaves.length === 0) return null;
  return leaves.length === 1 ? leaves[0] : { type: combinator, filters: leaves };
}

function isNumericField(field: string): boolean {
  return field === "graduation_year";
}

/**
 * Rule tree → builder state. Returns null for shapes the flat builder can't
 * represent (nested groups, an OR containing a year range); those rules still
 * run, they're just not editable in the builder.
 */
export function nodeToConditions(node: FilterNode | null): { conditions: Condition[]; combinator: "and" | "or" } | null {
  if (!node) return { conditions: [], combinator: "and" };
  const leaf = (n: FilterNode): Condition[] | null => {
    if (n.type === "field") return [{ id: newConditionId(), field: n.field, op: n.op, value: n.value === undefined ? "" : String(n.value) }];
    if (n.type === "category") return [{ id: newConditionId(), field: "role", op: "eq", value: n.value }];
    if (n.type === "grad_year_eq") return [{ id: newConditionId(), field: "graduation_year", op: "eq", value: String(n.value) }];
    if (n.type === "grad_year_range") {
      return [
        { id: newConditionId(), field: "graduation_year", op: "gte", value: String(n.min) },
        { id: newConditionId(), field: "graduation_year", op: "lte", value: String(n.max) },
      ];
    }
    return null;
  };
  if (node.type === "and" || node.type === "or") {
    const out: Condition[] = [];
    for (const f of node.filters) {
      const c = leaf(f);
      if (!c) return null;
      if (node.type === "or" && c.length > 1) return null;
      out.push(...c);
    }
    return { conditions: out, combinator: node.type };
  }
  const c = leaf(node);
  return c ? { conditions: c, combinator: "and" } : null;
}

// ─── Plain-English summary ────────────────────────────────────────────────────

const OP_WORDS: Record<FieldOp, string> = {
  eq: "is", neq: "is not", gte: "is at least", lte: "is at most", contains: "contains", empty: "is empty", not_empty: "is set",
};

export function describeRule(node: FilterNode | null, catalog: RuleCatalog): string {
  if (!node) return "Everyone";
  const choices = fieldChoices(catalog);
  const leaf = (n: FilterNode): string => {
    if (n.type === "field") {
      const choice = choices.find((c) => c.field === n.field);
      const label = choice?.label.replace(/ \(.*\)$/, "") ?? n.field;
      if (n.field === "tag") {
        const tag = catalog.tags.find((t) => t.id === String(n.value))?.name ?? "a tag";
        return `${n.op === "neq" ? "doesn't have" : "has"} tag ${tag}`;
      }
      if (n.field === "role") {
        const role = ROLE_OPTIONS.find((r) => r.value === n.value)?.label ?? String(n.value);
        return `${label.split(" ")[0]} ${OP_WORDS[n.op]} ${role}`;
      }
      if (choice?.kind === "contact") return `${label} ${n.op === "empty" ? "is missing" : "is on file"}`;
      if (n.op === "empty" || n.op === "not_empty") return `${label} ${OP_WORDS[n.op]}`;
      return `${label} ${OP_WORDS[n.op]} ${n.value}`;
    }
    if (n.type === "category") return `Role is ${ROLE_OPTIONS.find((r) => r.value === n.value)?.label ?? n.value}`;
    if (n.type === "grad_year_eq") return `Graduation year is ${n.value}`;
    if (n.type === "grad_year_range") return `Graduation year is ${n.min}–${n.max}`;
    return "";
  };
  if (node.type === "and" || node.type === "or") {
    const word = node.type === "and" ? " AND " : " OR ";
    return node.filters.map((f) => (f.type === "and" || f.type === "or" ? `(${describeRule(f, catalog)})` : leaf(f))).join(word);
  }
  return leaf(node);
}

// ─── Evaluation (pure; used on the server) ────────────────────────────────────

export type RulePerson = {
  id: string;
  categories: string[] | null;
  grade: string | null;
  graduation_year: number | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  custom_fields: Record<string, unknown> | null;
};

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

function compareNumbers(op: FieldOp, actual: number | null, expected: number): boolean {
  if (actual === null || Number.isNaN(actual)) return op === "neq";
  if (op === "eq") return actual === expected;
  if (op === "neq") return actual !== expected;
  if (op === "gte") return actual >= expected;
  if (op === "lte") return actual <= expected;
  return false;
}

export function matchesRule(person: RulePerson, node: FilterNode, tagsByPerson?: Map<string, Set<string>>): boolean {
  switch (node.type) {
    case "and":
      return node.filters.every((f) => matchesRule(person, f, tagsByPerson));
    case "or":
      return node.filters.some((f) => matchesRule(person, f, tagsByPerson));
    case "category":
      return (person.categories ?? []).includes(node.value);
    case "grad_year_eq":
      return person.graduation_year === node.value;
    case "grad_year_range":
      return person.graduation_year !== null && person.graduation_year >= node.min && person.graduation_year <= node.max;
    case "field": {
      const { field, op } = node;
      const value = node.value;
      if (field === "role") {
        const has = (person.categories ?? []).includes(String(value));
        return op === "neq" ? !has : has;
      }
      if (field === "tag") {
        const has = tagsByPerson?.get(person.id)?.has(String(value)) ?? false;
        return op === "neq" ? !has : has;
      }
      if (field === "grade") {
        if (op === "empty") return blank(person.grade);
        if (op === "not_empty") return !blank(person.grade);
        if (op === "eq") return sameGrade(person.grade, String(value));
        if (op === "neq") return !sameGrade(person.grade, String(value));
        const actual = gradeRank(person.grade);
        const expected = gradeRank(String(value));
        if (actual === null || expected === null) return false;
        return op === "gte" ? actual >= expected : op === "lte" ? actual <= expected : false;
      }
      if (field === "graduation_year") {
        if (op === "empty") return person.graduation_year === null;
        if (op === "not_empty") return person.graduation_year !== null;
        return compareNumbers(op, person.graduation_year, Number(value));
      }
      if (field === "email" || field === "phone" || field === "whatsapp") {
        const present = !blank(person[field]);
        return op === "empty" ? !present : present;
      }
      if (field.startsWith("custom:")) {
        const raw = person.custom_fields?.[field.slice(7)];
        if (op === "empty") return blank(raw);
        if (op === "not_empty") return !blank(raw);
        if (typeof value === "number" || op === "gte" || op === "lte") {
          return compareNumbers(op, blank(raw) ? null : Number(raw), Number(value));
        }
        const actual = String(raw ?? "").trim().toLowerCase();
        const expected = String(value ?? "").trim().toLowerCase();
        if (op === "eq") return actual === expected;
        if (op === "neq") return actual !== expected;
        if (op === "contains") return actual.includes(expected);
      }
      return false;
    }
  }
}

/** Tag ids referenced by a rule (so the evaluator only loads person_tags when needed). */
export function ruleTagIds(node: FilterNode): string[] {
  if (node.type === "and" || node.type === "or") return node.filters.flatMap(ruleTagIds);
  return node.type === "field" && node.field === "tag" && node.value !== undefined ? [String(node.value)] : [];
}
