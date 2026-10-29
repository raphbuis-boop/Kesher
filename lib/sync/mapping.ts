/**
 * Column mapping: turns a table (CSV/Excel/Google Sheet) into normalized
 * sync records. Pure functions — used in the browser for the mapping step
 * and on the server to build the batch the engine diffs.
 *
 * Two layouts:
 *   "student" — one row per student, with up to two parents on the row
 *               (the usual FACTS / registrar roster export)
 *   "person"  — one row per person (parents, students, staff), grouped into
 *               families by a family ID column
 */

import type { PersonKind, ProvidedField, RowProblem, SyncBatch, SyncHousehold, SyncLink, SyncPerson } from "./types";

export type RowMode = "student" | "person";

export type ColumnMapping = {
  mode: RowMode;
  /** header → target (see TARGETS); "ignore" or missing = not imported */
  columns: Record<string, string>;
  defaults?: {
    p1Relationship?: string;
    p2Relationship?: string;
    /** person mode: kind for rows without a recognizable role */
    personKind?: PersonKind;
  };
};

export type TargetDef = { value: string; label: string; group: string; modes: RowMode[] };

const PARENT_FIELDS = (n: 1 | 2): TargetDef[] => [
  { value: `p${n}_id`, label: `Parent ${n} ID`, group: `Parent ${n}`, modes: ["student"] },
  { value: `p${n}_first_name`, label: `Parent ${n} first name`, group: `Parent ${n}`, modes: ["student"] },
  { value: `p${n}_last_name`, label: `Parent ${n} last name`, group: `Parent ${n}`, modes: ["student"] },
  { value: `p${n}_full_name`, label: `Parent ${n} full name`, group: `Parent ${n}`, modes: ["student"] },
  { value: `p${n}_email`, label: `Parent ${n} email`, group: `Parent ${n}`, modes: ["student"] },
  { value: `p${n}_phone`, label: `Parent ${n} cell phone`, group: `Parent ${n}`, modes: ["student"] },
  { value: `p${n}_whatsapp`, label: `Parent ${n} WhatsApp`, group: `Parent ${n}`, modes: ["student"] },
  { value: `p${n}_relationship`, label: `Parent ${n} relationship`, group: `Parent ${n}`, modes: ["student"] },
];

export const TARGETS: TargetDef[] = [
  { value: "family_id", label: "Family ID", group: "Family", modes: ["student", "person"] },
  { value: "family_name", label: "Family name", group: "Family", modes: ["student", "person"] },
  { value: "address", label: "Address", group: "Family", modes: ["student", "person"] },
  { value: "student_id", label: "Student ID", group: "Student", modes: ["student"] },
  { value: "student_first_name", label: "Student first name", group: "Student", modes: ["student"] },
  { value: "student_last_name", label: "Student last name", group: "Student", modes: ["student"] },
  { value: "student_full_name", label: "Student full name", group: "Student", modes: ["student"] },
  { value: "grade", label: "Grade", group: "Student", modes: ["student", "person"] },
  { value: "graduation_year", label: "Graduation year", group: "Student", modes: ["student", "person"] },
  { value: "student_email", label: "Student email", group: "Student", modes: ["student"] },
  { value: "student_phone", label: "Student phone", group: "Student", modes: ["student"] },
  ...PARENT_FIELDS(1),
  ...PARENT_FIELDS(2),
  { value: "person_id", label: "Person ID", group: "Person", modes: ["person"] },
  { value: "first_name", label: "First name", group: "Person", modes: ["person"] },
  { value: "last_name", label: "Last name", group: "Person", modes: ["person"] },
  { value: "full_name", label: "Full name", group: "Person", modes: ["person"] },
  { value: "email", label: "Email", group: "Person", modes: ["person"] },
  { value: "phone", label: "Cell phone", group: "Person", modes: ["person"] },
  { value: "whatsapp", label: "WhatsApp", group: "Person", modes: ["person"] },
  { value: "role", label: "Role (parent / student / staff…)", group: "Person", modes: ["person"] },
];

/** Targets that count as a stable ID for the "requires an ID column" rule. */
export const ID_TARGETS: Record<RowMode, string[]> = {
  student: ["student_id", "family_id"],
  person: ["person_id", "family_id"],
};

// ─── Auto-suggest ─────────────────────────────────────────────────────────────

function norm(h: string): string {
  return h.toLowerCase().replace(/[_\-./#]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Which parent slot a header refers to, if any. Mother → 1, Father → 2. */
function parentSlot(h: string): { slot: 1 | 2; rel: string } | null {
  if (/\b(mother|mom|mrs)\b/.test(h)) return { slot: 1, rel: "mother" };
  if (/\b(father|dad)\b/.test(h)) return { slot: 2, rel: "father" };
  const m = h.match(/\b(?:parent|guardian|contact)\s*([12])\b/) ?? h.match(/\b(?:parent|guardian)([12])\b/);
  if (m) return { slot: m[1] === "2" ? 2 : 1, rel: "parent" };
  if (/\b(parent|guardian)\b/.test(h)) return { slot: 1, rel: "parent" };
  return null;
}

function fieldOf(h: string): string | null {
  if (/\b(e ?mail)\b/.test(h)) return "email";
  if (/whats ?app/.test(h)) return "whatsapp";
  if (/\b(cell|mobile|phone|tel)\b/.test(h)) return "phone";
  if (/\bfirst\b|\bgiven\b/.test(h)) return "first_name";
  if (/\blast\b|\bsurname\b/.test(h)) return "last_name";
  if (/\b(relationship|relation)\b/.test(h)) return "relationship";
  if (/\bid\b|\bnumber\b|\bno\b/.test(h)) return "id";
  if (/\bname\b/.test(h)) return "full_name";
  return null;
}

/**
 * Best-guess mapping from header names. Picks the layout from the headers:
 * any parent/mother/father columns → one row per student.
 */
export function suggestMapping(headers: string[], customFields: { key: string; label: string }[] = []): ColumnMapping {
  const hs = headers.map(norm);
  const mode: RowMode = hs.some((h) => parentSlot(h) && fieldOf(h)) ? "student" : "person";
  const columns: Record<string, string> = {};
  const used = new Set<string>();
  const defaults: ColumnMapping["defaults"] = {};

  const take = (header: string, target: string) => {
    if (used.has(target) || columns[header]) return;
    columns[header] = target;
    used.add(target);
  };

  headers.forEach((header, i) => {
    const h = hs[i];
    const custom = customFields.find((c) => norm(c.label) === h || c.key === h.replace(/ /g, "_"));
    if (custom) return take(header, `custom:${custom.key}`);

    if (/\b(family|household)\b.*\b(id|number|no|code)\b|^family ?id$|^fam ?id$/.test(h)) return take(header, "family_id");
    if (/\b(family|household) name\b/.test(h)) return take(header, "family_name");
    if (/\baddress\b|\bstreet\b/.test(h)) return take(header, "address");
    if (/\b(graduation|grad|class of|class year)\b/.test(h) && !/name/.test(h)) return take(header, "graduation_year");
    if (/^(current )?grade( level)?$|^gr$/.test(h)) return take(header, "grade");

    const slot = mode === "student" ? parentSlot(h) : null;
    const field = fieldOf(h);
    if (slot && field) {
      if (slot.rel !== "parent") defaults[slot.slot === 1 ? "p1Relationship" : "p2Relationship"] = slot.rel;
      return take(header, `p${slot.slot}_${field}`);
    }

    if (mode === "student") {
      if (/\bstudent\b/.test(h) && field) return take(header, `student_${field}`);
      if (field === "id" && !/\bparent|family\b/.test(h)) return take(header, "student_id");
      if (field === "first_name") return take(header, "student_first_name");
      if (field === "last_name") return take(header, "student_last_name");
      if (field === "full_name") return take(header, "student_full_name");
      return;
    }

    if (/\b(role|type|relationship|category)\b/.test(h)) return take(header, "role");
    if (field === "id") return take(header, "person_id");
    if (field) take(header, field);
  });

  return { mode, columns, defaults };
}

// ─── Value cleaning ───────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(v: string): string | null {
  const e = v.trim().toLowerCase().replace(/^mailto:/, "");
  return e && EMAIL_RE.test(e) ? e : null;
}

export function phoneDigits(v: string | null | undefined): string {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** "Grade 5" / "5th" / "05" → "5"; "Kindergarten" → "K"; "PK" → "Pre-K". */
export function normalizeGrade(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (/^(k|kg|kindergarten|kinder)$/.test(low)) return "K";
  if (/^(pk|pre ?k|pre-k|prek|pre-kindergarten|nursery|n)$/.test(low)) return "Pre-K";
  const m = low.match(/(\d{1,2})/);
  if (m && /^(grade\s*)?\d{1,2}(st|nd|rd|th)?(\s*grade)?$/.test(low)) return String(Number(m[1]));
  return s;
}

function cleanYear(v: string): number | null {
  const m = v.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

/** "Cohen, Moshe" or "Moshe Cohen" → first/last. */
export function splitName(full: string): { first: string; last: string } {
  const s = full.trim().replace(/\s+/g, " ");
  if (!s) return { first: "", last: "" };
  if (s.includes(",")) {
    const [last, first] = s.split(",", 2).map((x) => x.trim());
    return { first: first ?? "", last: last ?? "" };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

const RELATIONSHIP_WORDS: Record<string, string> = {
  mother: "mother", mom: "mother", mommy: "mother", ima: "mother", stepmother: "mother",
  father: "father", dad: "father", abba: "father", stepfather: "father",
  parent: "parent", guardian: "guardian", grandmother: "grandparent", grandfather: "grandparent",
  grandparent: "grandparent", bubby: "grandparent", zaidy: "grandparent",
};

function normalizeRelationship(v: string, fallback: string): string {
  return RELATIONSHIP_WORDS[v.trim().toLowerCase()] ?? fallback;
}

function kindFromRole(v: string, fallback: PersonKind): PersonKind {
  const r = v.trim().toLowerCase();
  if (!r) return fallback;
  if (/student|child|talmid|talmida|pupil/.test(r)) return "student";
  if (/parent|mother|father|guardian|mom|dad/.test(r)) return "guardian";
  if (/teacher|faculty|rebbe|morah|rabbi|instructor/.test(r)) return "faculty";
  if (/staff|admin|office|principal|secretary|employee/.test(r)) return "staff";
  return fallback;
}

// ─── Rows → batch ─────────────────────────────────────────────────────────────

export type TableData = { headers: string[]; rows: string[][] };

type Cells = Record<string, string>;

function readRow(headers: string[], row: string[], mapping: ColumnMapping): Cells {
  const cells: Cells = {};
  headers.forEach((h, i) => {
    const target = mapping.columns[h];
    if (!target || target === "ignore") return;
    const v = String(row[i] ?? "").trim();
    if (v && !cells[target]) cells[target] = v;
  });
  return cells;
}

function nameFrom(cells: Cells, first: string, last: string, full: string): { first: string; last: string } {
  if (cells[first] || cells[last]) return { first: cells[first] ?? "", last: cells[last] ?? "" };
  return splitName(cells[full] ?? "");
}

function customFrom(cells: Cells): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cells)) if (k.startsWith("custom:")) out[k.slice(7)] = v;
  return out;
}

function providedFields(mapping: ColumnMapping, prefix: string): ProvidedField[] {
  const targets = new Set(Object.values(mapping.columns));
  const out: ProvidedField[] = [];
  if (targets.has(`${prefix}email`)) out.push("email");
  if (targets.has(`${prefix}phone`)) out.push("phone");
  if (targets.has(`${prefix}whatsapp`)) out.push("whatsapp");
  if (targets.has("grade") && (prefix === "student_" || prefix === "")) out.push("grade");
  if (targets.has("graduation_year") && (prefix === "student_" || prefix === "")) out.push("graduation_year");
  return out;
}

/** Fallback identity when the source has no IDs: email → phone → name. */
function fallbackId(email: string | null, phone: string | null, first: string, last: string, scope: string): string | null {
  if (email) return `email:${email}`;
  const d = phoneDigits(phone);
  if (d.length >= 7) return `phone:${d}`;
  const n = `${first} ${last}`.trim().toLowerCase();
  return n ? `name:${n}${scope ? `|${scope}` : ""}` : null;
}

/** Merges a repeated record (same person on several rows): first non-empty value wins. */
function mergePerson(into: SyncPerson, from: SyncPerson) {
  into.email ??= from.email;
  into.phone ??= from.phone;
  into.whatsapp ??= from.whatsapp;
  into.firstName ||= from.firstName;
  into.lastName ||= from.lastName;
  for (const [k, v] of Object.entries(from.customFields)) into.customFields[k] ??= v;
}

export function buildBatch(table: TableData, mapping: ColumnMapping): SyncBatch {
  const targets = new Set(Object.values(mapping.columns));
  const hasIds = ID_TARGETS[mapping.mode].some((t) => targets.has(t));
  const warnings: string[] = [];
  const problems: RowProblem[] = [];
  if (!hasIds) {
    warnings.push(
      mapping.mode === "student"
        ? "This file has no Student ID or Family ID column, so Kesher matches families by parent email or phone instead. If a parent changes their email, they'll show up as a new person — add an ID column to your export if you can."
        : "This file has no ID column, so Kesher matches people by email, then phone, then name. If someone's email changes they'll show up as a new person — add an ID column to your export if you can."
    );
  }

  let unidentified = 0;
  const households = new Map<string, SyncHousehold>();
  const people = new Map<string, SyncPerson>();
  const links = new Map<string, SyncLink>();

  const addHousehold = (id: string | null, name: string, address: string | null) => {
    if (!id) return;
    const existing = households.get(id);
    if (existing) {
      existing.name ||= name;
      existing.address ??= address;
    } else households.set(id, { sourceId: id, name, address });
  };

  const addPerson = (p: SyncPerson, rowNum: number): string => {
    const existing = people.get(p.sourceId);
    if (!existing) {
      people.set(p.sourceId, p);
      return p.sourceId;
    }
    const sameName =
      !existing.firstName || !p.firstName ||
      `${existing.firstName} ${existing.lastName}`.toLowerCase() === `${p.firstName} ${p.lastName}`.toLowerCase();
    if (!sameName && existing.kind === p.kind && p.kind === "student") {
      problems.push({ row: rowNum, message: `ID ${p.sourceId} is used for both ${existing.firstName} ${existing.lastName} and ${p.firstName} ${p.lastName} — kept the first.` });
      return existing.sourceId;
    }
    mergePerson(existing, p);
    return existing.sourceId;
  };

  table.rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header is row 1
    if (row.every((c) => !String(c ?? "").trim())) return;
    const cells = readRow(table.headers, row, mapping);
    const familyId = cells.family_id ?? null;
    const address = cells.address ?? null;
    const grade = cells.grade ? normalizeGrade(cells.grade) : null;
    const gradYear = cells.graduation_year ? cleanYear(cells.graduation_year) : null;

    const email = (key: string) => {
      const raw = cells[key];
      if (!raw) return null;
      const clean = cleanEmail(raw);
      if (!clean) problems.push({ row: rowNum, message: `"${raw}" isn't a valid email — imported without it.` });
      return clean;
    };

    if (mapping.mode === "student") {
      const sName = nameFrom(cells, "student_first_name", "student_last_name", "student_full_name");
      if (!sName.first && !sName.last) {
        problems.push({ row: rowNum, message: "No student name — row skipped." });
        return;
      }
      const sEmail = email("student_email");
      const parents = ([1, 2] as const).map((n) => {
        const name = nameFrom(cells, `p${n}_first_name`, `p${n}_last_name`, `p${n}_full_name`);
        return {
          n,
          name,
          email: email(`p${n}_email`),
          phone: cells[`p${n}_phone`] ?? null,
          whatsapp: cells[`p${n}_whatsapp`] ?? null,
          id: cells[`p${n}_id`] ?? null,
          relationship: normalizeRelationship(
            cells[`p${n}_relationship`] ?? "",
            (n === 1 ? mapping.defaults?.p1Relationship : mapping.defaults?.p2Relationship) ?? "parent"
          ),
        };
      }).filter((p) => p.name.first || p.name.last || p.email || p.phone || p.id);

      // No family ID: siblings are grouped by their first parent's email/phone
      const householdId =
        familyId ??
        (parents[0] ? fallbackId(parents[0].email, parents[0].phone, parents[0].name.first, parents[0].name.last, "") : null);
      const familyName = cells.family_name ?? (sName.last ? `${sName.last} family` : "");
      addHousehold(householdId, familyName, address);

      const studentSourceId =
        cells.student_id ??
        (familyId ? `${familyId}:${sName.first.toLowerCase()}` : fallbackId(null, null, sName.first, sName.last, householdId ?? ""));
      if (!studentSourceId) return;

      const studentId = addPerson(
        {
          sourceId: studentSourceId,
          kind: "student",
          householdSourceId: householdId,
          firstName: sName.first,
          lastName: sName.last,
          email: sEmail,
          phone: cells.student_phone ?? null,
          whatsapp: null,
          grade,
          graduationYear: gradYear,
          customFields: customFrom(cells),
          provided: providedFields(mapping, "student_"),
        },
        rowNum
      );

      if (parents.length === 0) {
        problems.push({ row: rowNum, message: `${sName.first} ${sName.last} has no parent on this row — the family won't get messages until one is added.` });
      }

      for (const p of parents) {
        const gid =
          p.id ??
          (familyId ? `${familyId}:p${p.n}` : fallbackId(p.email, p.phone, p.name.first, p.name.last, householdId ?? ""));
        if (!gid) continue;
        const last = p.name.last || sName.last;
        const guardianId = addPerson(
          {
            sourceId: gid,
            kind: "guardian",
            householdSourceId: householdId,
            firstName: p.name.first,
            lastName: last,
            email: p.email,
            phone: p.phone,
            whatsapp: p.whatsapp,
            grade: null,
            graduationYear: null,
            customFields: {},
            provided: providedFields(mapping, `p${p.n}_`),
          },
          rowNum
        );
        links.set(`${guardianId}→${studentId}`, {
          guardianSourceId: guardianId,
          studentSourceId: studentId,
          relationship: p.relationship,
          custodial: true,
          receivesMessages: true,
        });
      }
      return;
    }

    // ── person mode ──
    const name = nameFrom(cells, "first_name", "last_name", "full_name");
    if (!name.first && !name.last) {
      problems.push({ row: rowNum, message: "No name — row skipped." });
      return;
    }
    const pEmail = email("email");
    const kind = kindFromRole(cells.role ?? "", mapping.defaults?.personKind ?? "other");
    const sourceId =
      cells.person_id ??
      (familyId ? `${familyId}:${name.first.toLowerCase()}` : null) ??
      fallbackId(pEmail, cells.phone ?? null, name.first, name.last, "");
    if (!sourceId) return;
    if (hasIds && !cells.person_id && !familyId) unidentified++;
    addHousehold(familyId, cells.family_name ?? (name.last ? `${name.last} family` : ""), address);
    addPerson(
      {
        sourceId,
        kind,
        householdSourceId: familyId,
        firstName: name.first,
        lastName: name.last,
        email: pEmail,
        phone: cells.phone ?? null,
        whatsapp: cells.whatsapp ?? null,
        grade: kind === "student" ? grade : null,
        graduationYear: kind === "student" ? gradYear : null,
        customFields: customFrom(cells),
        provided: providedFields(mapping, ""),
      },
      rowNum
    );
    if (cells.role) {
      const rel = normalizeRelationship(cells.role, "parent");
      people.get(sourceId)!.customFields.__relationship = rel;
    }
  });

  // person mode: link guardians and students that share a family
  if (mapping.mode === "person") {
    const byFamily = new Map<string, SyncPerson[]>();
    for (const p of people.values()) {
      if (!p.householdSourceId) continue;
      const list = byFamily.get(p.householdSourceId) ?? [];
      list.push(p);
      byFamily.set(p.householdSourceId, list);
    }
    for (const members of byFamily.values()) {
      const guardians = members.filter((m) => m.kind === "guardian");
      const students = members.filter((m) => m.kind === "student");
      for (const g of guardians) {
        for (const s of students) {
          links.set(`${g.sourceId}→${s.sourceId}`, {
            guardianSourceId: g.sourceId,
            studentSourceId: s.sourceId,
            relationship: g.customFields.__relationship ?? "parent",
            custodial: true,
            receivesMessages: true,
          });
        }
      }
    }
    for (const p of people.values()) delete p.customFields.__relationship;
  }

  if (unidentified > 0) {
    warnings.push(`${unidentified} ${unidentified === 1 ? "row has" : "rows have"} no ID or family ID, so ${unidentified === 1 ? "it's" : "they're"} matched by email, then phone, then name.`);
  }

  return {
    households: [...households.values()],
    people: [...people.values()],
    links: [...links.values()],
    warnings,
    problems,
    idStrategy: hasIds ? "source_ids" : "fallback",
  };
}

/** Header signature used to pick the saved source a re-uploaded file belongs to. */
export function headerOverlap(headers: string[], mapping: ColumnMapping): number {
  const mapped = Object.keys(mapping.columns);
  if (mapped.length === 0) return 0;
  const set = new Set(headers);
  return mapped.filter((h) => set.has(h)).length / mapped.length;
}
