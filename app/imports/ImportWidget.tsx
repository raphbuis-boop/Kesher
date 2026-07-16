"use client";

import { useState, useRef, useTransition } from "react";
import { commitImport, type CommitRow } from "./commitImport";

// ─── Types ────────────────────────────────────────────────────────────────────

type RawRow = {
  salutation: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  grade: string;
  graduating_year: string;
  parent_of: string;
  notes: string;
  address: string;
};

type EnrichedRow = {
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
  flagged: boolean;
  flag_reason: string;
  // Pass-through fields the AI doesn't touch — merged back by index after enrichment
  address: string;
};

type Stage =
  | { type: "idle" }
  | { type: "parsing"; fileName: string; rawRows: RawRow[] }
  | { type: "preview"; fileName: string; rows: EnrichedRow[] }
  | { type: "done"; imported: number; failed: number; countBefore: number; countAfter: number; dbError: string | null }
  | { type: "error"; message: string };

const ROLE_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty" },
  { value: "alumni", label: "Alumni" },
  { value: "donor", label: "Donor" },
  { value: "staff", label: "Staff" },
  { value: "board", label: "Board" },
  { value: "grandparent", label: "Grandparent" },
  { value: "prospect", label: "Prospect" },
];

// ─── Deterministic fallback enrichment (used when AI is unavailable) ─────────

const THIS_YEAR = new Date().getFullYear();

const MALE_SAL = new Set(["mr.", "mr", "rabbi", "reb", "harav", "hav rav", "reverend", "cantor", "rav"]);
const FEMALE_SAL = new Set(["mrs.", "mrs", "ms.", "ms", "rebbetzin", "miss"]);
const NEUTRAL_SAL = new Set(["dr.", "dr", "prof.", "prof", "professor", "mx.", "mx"]);

function salToGender(sal: string): "male" | "female" | "unknown" {
  const s = sal.trim().toLowerCase();
  if (MALE_SAL.has(s)) return "male";
  if (FEMALE_SAL.has(s)) return "female";
  return "unknown";
}

const ROLE_CATEGORY_MAP: Record<string, string[]> = {
  parent: ["parent"], faculty: ["faculty"], student: ["student"],
  alumni: ["alumni"], alumna: ["alumni"], alum: ["alumni"],
  donor: ["donor"], staff: ["staff"], board: ["board"],
  grandparent: ["grandparent"], prospect: ["prospect"],
  teacher: ["faculty"], administrator: ["staff"],
};

function enrichRowsLocally(rawRows: RawRow[]): EnrichedRow[] {
  return rawRows.map((row) => {
    const gender = salToGender(row.salutation);
    const isNeutral = NEUTRAL_SAL.has(row.salutation.trim().toLowerCase()) || !row.salutation.trim();
    const categories = ROLE_CATEGORY_MAP[row.role.trim().toLowerCase()] ?? (row.role.trim() ? [] : []);

    const gradYearRaw = parseInt(row.graduating_year, 10);
    const gradeRaw = parseInt(row.grade, 10);
    const graduation_year = !isNaN(gradYearRaw)
      ? gradYearRaw
      : !isNaN(gradeRaw) ? THIS_YEAR + (12 - gradeRaw) : null;

    const reasons: string[] = [];
    if (!row.first_name.trim()) reasons.push("missing_name");
    // unknown_role is not flagged here — the bulk audience picker handles it
    if (isNeutral && categories.includes("parent")) reasons.push("gender_uncertain");
    if (categories.length > 1) reasons.push("multi_audience");
    // Only flag a malformed email — missing email is informational, not an error
    const emailPresent = !!row.email.trim();
    const emailOk = row.email.includes("@") && /\.\w/.test(row.email.split("@")[1] ?? "");
    if (emailPresent && !emailOk) reasons.push("invalid_email");

    const parent_role: "mom" | "dad" | null = categories.includes("parent")
      ? gender === "female" ? "mom" : gender === "male" ? "dad" : null
      : null;

    return {
      salutation: row.salutation,
      first_name: row.first_name,
      last_name: row.last_name,
      preferred_name: row.first_name,
      email: row.email,
      phone: row.phone,
      categories,
      graduation_year,
      gender,
      parent_role,
      notes: row.notes,
      parent_of: row.parent_of,
      flagged: reasons.length > 0,
      flag_reason: reasons.join("; "),
      address: row.address,
    };
  });
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      fields.push(current); current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ─── Header → RawRow field map ────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof RawRow> = {
  // Salutation
  "salutation": "salutation", "title": "salutation", "prefix": "salutation",

  // First name
  "first name": "first_name", "first_name": "first_name", "firstname": "first_name",
  "given name": "first_name",
  "parent 1 first name": "first_name", "parent1 first name": "first_name",
  "father first name": "first_name", "mother first name": "first_name",
  "guardian 1 first name": "first_name", "guardian first name": "first_name",

  // Last name
  "last name": "last_name", "last_name": "last_name", "lastname": "last_name",
  "surname": "last_name", "family name": "last_name",
  "parent 1 last name": "last_name", "parent1 last name": "last_name",
  "father last name": "last_name", "mother last name": "last_name",
  "guardian 1 last name": "last_name", "guardian last name": "last_name",

  // Email
  "email": "email", "email address": "email", "e-mail": "email",
  "work email": "email", "school email": "email", "primary email": "email",
  "home email": "email", "parent email": "email",
  "parent 1 email": "email", "parent1 email": "email",
  "father email": "email", "mother email": "email",
  "guardian 1 email": "email", "guardian email": "email",

  // Phone
  "phone": "phone", "phone number": "phone", "telephone": "phone",
  "cell": "phone", "cell phone": "phone", "mobile": "phone", "mobile phone": "phone",
  "home phone": "phone", "work phone": "phone", "primary phone": "phone",
  "parent phone": "phone", "parent 1 phone": "phone", "parent1 phone": "phone",
  "father phone": "phone", "mother phone": "phone",
  "guardian 1 phone": "phone", "guardian phone": "phone",

  // Role
  "role": "role", "type": "role", "relationship": "role", "contact type": "role",

  // Grade / graduation year
  "grade": "grade", "grade level": "grade", "current grade": "grade",
  "graduating year": "graduating_year", "graduating_year": "graduating_year",
  "graduation year": "graduating_year", "graduation_year": "graduating_year",
  "class year": "graduating_year", "class of": "graduating_year",
  "expected graduation": "graduating_year",

  // Parent of / child
  "parent of": "parent_of", "parent_of": "parent_of",
  "child": "parent_of", "child name": "parent_of", "children": "parent_of",
  "student name": "parent_of", "student": "parent_of",

  // Address
  "address": "address", "street": "address", "street address": "address",
  "mailing address": "address", "home address": "address",

  // Notes
  "notes": "notes", "comments": "notes", "memo": "notes", "remarks": "notes",
};

// Fields that belong to a specific person in a family row.
// Everything not in this set is treated as shared (copied to both contacts).
const PERSON_FIELDS = new Set<keyof RawRow>([
  "salutation", "first_name", "last_name", "email", "phone",
]);

/**
 * Detect the column index where a second "person block" starts.
 *
 * Strategy: scan headers left-to-right for the second occurrence of
 * a block-opening header ("title", "salutation", or "first name" variants).
 * Returns Infinity if the CSV is single-contact-per-row.
 *
 * Example CSV headers (lowercase):
 *   [0] student name  [3] title  [4] first name  [9] title  [10] first name
 *   → second "title" is at index 9 → spouseBlockStart = 9
 */
function detectSpouseBlockStart(rawHeaders: string[]): number {
  const blockOpeners = new Set(["title", "salutation", "prefix",
    "first name", "first_name", "firstname"]);
  const seen = new Set<string>();
  for (let i = 0; i < rawHeaders.length; i++) {
    const h = rawHeaders[i];
    if (blockOpeners.has(h)) {
      if (seen.has(h)) return i;
      seen.add(h);
    }
  }
  return Infinity;
}

function emptyRawRow(): RawRow {
  return {
    salutation: "", first_name: "", last_name: "", email: "", phone: "",
    role: "", grade: "", graduating_year: "", parent_of: "", notes: "", address: "",
  };
}

function parseCSV(text: string): RawRow[] {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const rawHeaders = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const spouseBlockStart = detectSpouseBlockStart(rawHeaders);
  const isFamilyRow = spouseBlockStart < Infinity;

  // Map each column index to { field, block }
  // block = "primary" | "spouse" | "shared"
  type ColInfo = { field: keyof RawRow; block: "primary" | "spouse" | "shared" };
  const colInfo: (ColInfo | null)[] = rawHeaders.map((h, i) => {
    const field = HEADER_MAP[h];
    if (!field) return null;
    if (!isFamilyRow) return { field, block: "shared" };
    if (PERSON_FIELDS.has(field)) {
      return { field, block: i < spouseBlockStart ? "primary" : "spouse" };
    }
    return { field, block: "shared" }; // address, parent_of, role, graduating_year, notes
  });

  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);

    const primary = emptyRawRow();
    const spouse = emptyRawRow();
    let primaryHasValue = false;
    let spouseHasName = false;

    colInfo.forEach((info, idx) => {
      if (!info) return;
      const val = (values[idx] ?? "").trim();
      if (!val) return;

      const { field, block } = info;

      if (block === "primary" || block === "shared") {
        primary[field] = val;
        primaryHasValue = true;
      }
      if (block === "spouse" || block === "shared") {
        spouse[field] = val;
        if (field === "first_name" || field === "last_name") spouseHasName = true;
      }
    });

    if (primaryHasValue) rows.push(primary);
    // Only emit a spouse row if there's actually a name in the spouse block
    if (isFamilyRow && spouseHasName) rows.push(spouse);
  }

  return rows;
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile, error, onClearError }: {
  onFile: (name: string, rows: RawRow[]) => void;
  error: string | null;
  onClearError: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      onClearError();
      return;
    }
    onClearError();
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) return;
      onFile(file.name, rows);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV file — click or drag and drop"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        className={
          "cursor-pointer select-none rounded-lg border-2 border-dashed px-8 py-14 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 " +
          (isDragging ? "border-zinc-400 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50")
        }
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-900">
              Drop a CSV here, or <span className="underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Review and confirm contacts before they're added to your directory.
            </p>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        <a href="/sample-contacts.csv" download className="underline underline-offset-2 hover:text-zinc-600 transition-colors">
          Download sample CSV
        </a>{" "}
        to see the expected format.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input ref={inputRef} type="file" accept=".csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ─── Editable preview table ───────────────────────────────────────────────────

const CELL = "px-2 py-0 text-xs";
const INPUT_BASE =
  "w-full rounded border-0 bg-transparent px-1 py-1.5 text-xs text-zinc-900 outline-none focus:bg-zinc-50 focus:ring-1 focus:ring-zinc-300 transition-colors";
const SELECT_BASE =
  "w-full rounded border-0 bg-transparent px-1 py-1.5 text-xs text-zinc-900 outline-none focus:bg-zinc-50 focus:ring-1 focus:ring-zinc-300 transition-colors appearance-none cursor-pointer";

// Plain-English chips shown per flagged row
function flagChips(reason: string): string[] {
  const chips: string[] = [];
  if (reason.includes("missing_name")) chips.push("Missing name");
  if (reason.includes("invalid_email")) chips.push("Check email");
  if (reason.includes("multi_audience")) chips.push("Check roles");
  // gender_uncertain: amber ring on the Gender dropdown is sufficient — no chip
  // unknown_role: handled by the bulk audience picker — no chip
  // If none of the above, return empty — row is highlighted by left border only
  return chips;
}

function PreviewTable({
  rows,
  onChange,
}: {
  rows: EnrichedRow[];
  onChange: (idx: number, field: keyof EnrichedRow, value: EnrichedRow[keyof EnrichedRow]) => void;
}) {
  // Sort flagged rows to the top; preserve relative order within each group
  const sorted = [
    ...rows.map((r, i) => ({ r, i })).filter(({ r }) => r.flagged),
    ...rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.flagged),
  ];

  // Actionable issues (amber) — things that need a decision
  const noName      = rows.filter((r) => r.flag_reason.includes("missing_name")).length;
  const needsGender = rows.filter((r) => r.flag_reason.includes("gender_uncertain")).length;
  const badEmail    = rows.filter((r) => r.flag_reason.includes("invalid_email")).length;
  // Informational only — not a blocker
  const noEmail     = rows.filter((r) => !r.email.trim()).length;

  const actionItems: string[] = [];
  if (noName > 0)
    actionItems.push(`${noName} ${noName === 1 ? "contact is" : "contacts are"} missing a name.`);
  if (needsGender > 0)
    actionItems.push(`${needsGender} ${needsGender === 1 ? "contact needs" : "contacts need"} a gender confirmed — please update the Gender column.`);
  if (badEmail > 0)
    actionItems.push(`${badEmail} ${badEmail === 1 ? "contact has" : "contacts have"} an email address that doesn't look right.`);

  return (
    <div className="space-y-3">
      {actionItems.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-amber-700">Please review before continuing:</p>
            {actionItems.map((s) => (
              <p key={s} className="text-xs text-amber-600">{s}</p>
            ))}
          </div>
        </div>
      )}
      {noEmail > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p className="text-xs text-zinc-500">
            {noEmail === 1 ? "1 contact doesn't" : `${noEmail} contacts don't`} have an email address.
            {" "}These contacts can still receive SMS and WhatsApp messages.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-xs" style={{ minWidth: "1020px" }}>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="w-6 py-2.5 pl-3 pr-1" />
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500 min-w-[160px]" />
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">Title</th>
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">First Name</th>
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">Last Name</th>
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">Email</th>
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">Phone</th>
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">Audience</th>
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">Class Year</th>
              <th className="px-2 py-2.5 text-left font-medium uppercase tracking-wide text-zinc-500">Gender</th>
              <th className="px-2 py-2.5 pr-3 text-left font-medium uppercase tracking-wide text-zinc-500 whitespace-nowrap">Parent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {sorted.map(({ r: row, i: idx }, sortIdx) => (
              <tr
                key={idx}
                className={
                  row.flagged
                    ? "border-l-2 border-l-amber-400 bg-amber-50/40"
                    : sortIdx > 0 && sorted[sortIdx - 1].r.flagged
                    ? "border-t-2 border-t-zinc-200" // visual separator after flagged section
                    : ""
                }
              >
                {/* Review indicator */}
                <td className="pl-3 pr-1 py-1 text-center">
                  {row.flagged && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  )}
                </td>
                {/* Notes column — chips where actionable, blank otherwise */}
                <td className="px-2 py-1">
                  {(() => {
                    const chips = row.flagged ? flagChips(row.flag_reason) : [];
                    return chips.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {chips.map((chip) => (
                          <span key={chip} className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            {chip}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </td>
                <td className={CELL}>
                  <input className={INPUT_BASE} style={{ width: "80px" }} value={row.salutation}
                    onChange={(e) => onChange(idx, "salutation", e.target.value)} />
                </td>
                <td className={CELL}>
                  <input className={INPUT_BASE} style={{ width: "100px" }} value={row.first_name}
                    onChange={(e) => onChange(idx, "first_name", e.target.value)} />
                </td>
                <td className={CELL}>
                  <input className={INPUT_BASE} style={{ width: "100px" }} value={row.last_name}
                    onChange={(e) => onChange(idx, "last_name", e.target.value)} />
                </td>
                <td className={CELL}>
                  <input
                    className={INPUT_BASE + (row.flag_reason.includes("invalid_email") ? " ring-1 ring-amber-300" : "")}
                    style={{ width: "180px" }}
                    value={row.email}
                    onChange={(e) => onChange(idx, "email", e.target.value)}
                  />
                </td>
                <td className={CELL}>
                  <input className={INPUT_BASE} style={{ width: "120px" }} value={row.phone}
                    onChange={(e) => onChange(idx, "phone", e.target.value)} />
                </td>
                <td className={CELL}>
                  <select className={SELECT_BASE} style={{ width: "110px" }}
                    value={row.categories[0] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange(idx, "categories", v ? [v] : []);
                    }}>
                    <option value="">—</option>
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                <td className={CELL}>
                  <input className={INPUT_BASE} style={{ width: "80px" }} type="number" min={1900} max={2100}
                    value={row.graduation_year ?? ""}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      onChange(idx, "graduation_year", isNaN(n) ? null : n);
                    }} />
                </td>
                <td className={CELL}>
                  <select
                    className={SELECT_BASE + (row.flag_reason.includes("gender_uncertain") ? " ring-1 ring-amber-300" : "")}
                    style={{ width: "90px" }}
                    value={row.gender}
                    onChange={(e) => onChange(idx, "gender", e.target.value as EnrichedRow["gender"])}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="unknown">Not specified</option>
                  </select>
                </td>
                <td className={CELL + " pr-3"}>
                  <select className={SELECT_BASE} style={{ width: "80px" }}
                    value={row.parent_role ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChange(idx, "parent_role", (v === "mom" || v === "dad") ? v : null);
                    }}>
                    <option value="">—</option>
                    <option value="mom">Mom</option>
                    <option value="dad">Dad</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────

export function ImportWidget() {
  const [stage, setStage] = useState<Stage>({ type: "idle" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [aiUnavailable, setAiUnavailable] = useState(false);

  function reset() {
    setStage({ type: "idle" });
    setRows([]);
    setFileError(null);
    setAiUnavailable(false);
  }

  async function handleFile(name: string, rawRows: RawRow[]) {
    setStage({ type: "parsing", fileName: name, rawRows });
    setAiUnavailable(false);

    let enriched: EnrichedRow[] | null = null;

    try {
      const res = await fetch("/api/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rawRows }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        enriched = data.rows as EnrichedRow[];
      }
    } catch {
      // Network error — fall through to local enrichment
    }

    if (!enriched) {
      enriched = enrichRowsLocally(rawRows);
      setAiUnavailable(true);
    }

    setRows(enriched);
    setStage({ type: "preview", fileName: name, rows: enriched });
  }

  function updateRow<K extends keyof EnrichedRow>(idx: number, field: K, value: EnrichedRow[K]) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  function applyDefaultAudience(category: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.categories.length === 0 ? { ...r, categories: [category], flagged: false, flag_reason: "" } : r
      )
    );
  }

  function handleCommit() {
    const fileName = stage.type === "preview" ? stage.fileName : "import.csv";
    const commitRows: CommitRow[] = rows.map((r) => ({
      salutation: r.salutation,
      first_name: r.first_name,
      last_name: r.last_name,
      preferred_name: r.preferred_name || r.first_name,
      email: r.email,
      phone: r.phone,
      categories: r.categories,
      graduation_year: r.graduation_year,
      gender: r.gender,
      parent_role: r.parent_role,
      notes: r.notes,
      parent_of: r.parent_of,
      address: r.address,
    }));

    startTransition(async () => {
      const result = await commitImport(fileName, commitRows);
      // Always go to done — show diagnostic counts regardless of error
      setStage({
        type: "done",
        imported: result.imported,
        failed: result.failed,
        countBefore: result.countBefore,
        countAfter: result.countAfter,
        dbError: result.firstErrorMessage,
      });
    });
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (stage.type === "idle") {
    return (
      <DropZone
        onFile={handleFile}
        error={fileError}
        onClearError={() => setFileError(null)}
      />
    );
  }

  // ── Parsing ───────────────────────────────────────────────────────────────
  if (stage.type === "parsing") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 bg-white py-16 text-center">
        <svg className="h-6 w-6 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-zinc-900">Reading your contacts…</p>
          <p className="mt-0.5 text-xs text-zinc-400">This will only take a moment.</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (stage.type === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="text-sm font-medium text-red-700">Something went wrong</p>
        <p className="mt-1 text-sm text-red-600">Please check your file and try again.</p>
        <button onClick={reset} className="mt-4 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50">
          Try Again
        </button>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (stage.type === "done") {
    const reallyWorked = stage.countAfter > stage.countBefore;
    return (
      <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center">
        <div className={`flex h-10 w-10 mx-auto items-center justify-center rounded-full ${reallyWorked ? "bg-zinc-900" : "bg-red-500"}`}>
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {reallyWorked
              ? <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />}
          </svg>
        </div>
        <p className="mt-3 text-sm font-semibold text-zinc-900">
          {reallyWorked
            ? `${stage.imported.toLocaleString()} ${stage.imported === 1 ? "contact" : "contacts"} added successfully`
            : "Import did not save any contacts"}
        </p>

        {stage.failed > 0 && (
          <p className="mt-3 text-sm text-zinc-500">
            {stage.failed} {stage.failed === 1 ? "contact" : "contacts"} could not be added.
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-3">
          <a href="/people" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700">
            View Contacts
          </a>
          <button onClick={reset} className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
            Import Another File
          </button>
        </div>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  const validRows = rows.filter((r) => r.first_name.trim() && r.last_name.trim());
  const noAudienceCount = rows.filter((r) => r.categories.length === 0).length;
  const canCommit = validRows.length > 0 && noAudienceCount === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="text-sm font-medium text-zinc-900">
            {stage.type === "preview" ? stage.fileName : ""}
          </span>
          <span className="text-sm text-zinc-400">{rows.length} contacts</span>
        </div>
        <button onClick={reset} className="text-sm text-zinc-500 transition-colors hover:text-zinc-700">
          Choose different file
        </button>
      </div>

      {/* Bulk audience picker — shown when any contact has no audience */}
      {noAudienceCount > 0 && (
        <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
          </svg>
          <p className="text-sm text-zinc-700 shrink-0">
            {noAudienceCount === rows.length
              ? "What type of contacts are these?"
              : `${noAudienceCount} contacts don't have an audience. Apply one to all:`}
          </p>
          <select
            defaultValue=""
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400"
            onChange={(e) => { if (e.target.value) applyDefaultAudience(e.target.value); }}
          >
            <option value="" disabled>Select…</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Editable preview table */}
      <PreviewTable rows={rows} onChange={updateRow} />

      {/* Commit bar */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
        <p className="text-xs text-zinc-400">
          {noAudienceCount > 0
            ? "Choose an audience above to continue."
            : rows.filter((r) => r.flagged).length > 0
            ? `${rows.filter((r) => r.flagged).length} ${rows.filter((r) => r.flagged).length === 1 ? "contact is" : "contacts are"} marked for review. You can still continue.`
            : `Ready to add ${validRows.length} ${validRows.length === 1 ? "contact" : "contacts"} to your directory.`}
        </p>
        <button
          onClick={handleCommit}
          disabled={isPending || !canCommit}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Importing…
            </>
          ) : (
            <>
              Add {validRows.length} {validRows.length === 1 ? "contact" : "contacts"}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
