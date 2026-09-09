/**
 * Riverside Academy demo dataset — generation + insert logic.
 *
 * Pure "reset + reseed" for one org_id: deletes any existing tenant rows for
 * that org (safe — every delete is scoped `.eq("org_id", orgId)`), then
 * inserts a fresh, fictional, generic-American-private-school dataset.
 *
 * Never touches any other org_id. Uses fictional names/addresses, safe
 * @example.com emails, and NANP-reserved-fictional phone numbers (555-01XX).
 *
 * Imported by scripts/setup_riverside_demo.ts and scripts/reset_riverside_demo.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Deterministic-ish RNG helpers ─────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function chance(p: number): boolean {
  return Math.random() < p;
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Name / place pools (generic American, no ties to any real person) ────────

const MALE_FIRST = [
  "James", "Michael", "Robert", "John", "David", "William", "Richard", "Joseph",
  "Thomas", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Andrew",
  "Kevin", "Brian", "Steven", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob",
  "Nicholas", "Eric", "Benjamin", "Samuel", "Gregory", "Alexander", "Patrick",
  "Jack", "Henry", "Owen", "Lucas", "Ethan", "Noah", "Liam", "Mason", "Logan",
  "Caleb", "Wyatt", "Grant", "Cole", "Tyler", "Dylan", "Connor", "Hunter",
  "Nathan", "Adam", "Peter", "Marcus", "Diego", "Kenji", "Amir",
];

const FEMALE_FIRST = [
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan",
  "Jessica", "Sarah", "Karen", "Nancy", "Lisa", "Margaret", "Betty", "Sandra",
  "Ashley", "Emily", "Amanda", "Melissa", "Michelle", "Laura", "Kimberly",
  "Amy", "Angela", "Rebecca", "Stephanie", "Carolyn", "Rachel", "Catherine",
  "Olivia", "Emma", "Ava", "Sophia", "Isabella", "Charlotte", "Mia", "Amelia",
  "Harper", "Evelyn", "Abigail", "Grace", "Chloe", "Victoria", "Madison",
  "Natalie", "Hannah", "Lily", "Zoe", "Claire", "Samantha", "Priya", "Maya",
];

// Surname pool used for family units (each surname used once per family).
const FAMILY_LAST = [
  "Carter", "Bennett", "Foster", "Hayes", "Bishop", "Coleman", "Reeves",
  "Mercer", "Whitfield", "Sinclair", "Donovan", "Griffin", "Sullivan",
  "Harmon", "Prescott", "Lawson", "Kendrick", "Ashford", "Whitmore",
  "Callahan", "Pierce", "Hartley", "Winslow", "Chandler", "Sheffield",
  "Osborne", "Nguyen", "Patel", "Rodriguez", "Martinez", "Chen", "Park",
];

// Separate surname pool for standalone faculty/staff/alumni/board/prospects
// so they don't collide with seeded family surnames.
const STANDALONE_LAST = [
  "Bradley", "Sawyer", "Holloway", "Fletcher", "Abernathy", "Sterling",
  "Kingston", "Marsh", "Delgado", "Alvarez", "Flores", "Diaz", "Brooks",
  "Palmer", "Wallace", "Simmons", "Fitzgerald", "Whitaker", "Doyle", "Nash",
];

const STREETS = [
  "Maple St", "Oak Ave", "Cedar Ln", "Birch Rd", "Elm St", "Pine Ave",
  "Walnut Dr", "Cherry Ln", "Sunset Blvd", "Forest Rd", "Meadow Ln",
  "Summit Rd", "Brookside Ave", "Ridgewood Ave", "Hillside Terrace",
];

const NJ_TOWNS = [
  "Montclair, NJ", "Summit, NJ", "Princeton, NJ", "Ridgewood, NJ",
  "Westfield, NJ", "Morristown, NJ", "Short Hills, NJ", "Chatham, NJ",
  "Millburn, NJ", "Cherry Hill, NJ", "Livingston, NJ", "Tenafly, NJ",
  "Hoboken, NJ", "Basking Ridge, NJ",
];

const NJ_AREA_CODES = ["201", "908", "973", "609", "732", "856"];

// ─── Contact-detail generators (safe / fictional) ──────────────────────────────

let emailSeq = 0;
function email(first: string, last: string): string {
  emailSeq++;
  const base = `${first.toLowerCase().replace(/[^a-z]/g, "")}.${last.toLowerCase().replace(/[^a-z]/g, "")}`;
  return emailSeq > 60 ? `${base}${rand(1, 99)}@example.com` : `${base}@example.com`;
}

// NANP reserved-for-fiction range: (AC) 555-01XX — guaranteed not a real number.
function phone(): string {
  return `+1${pick(NJ_AREA_CODES)}555${String(rand(100, 199)).padStart(4, "0").slice(-4)}`;
}

function address(): string {
  return `${rand(10, 999)} ${pick(STREETS)}, ${pick(NJ_TOWNS)}`;
}

// ─── Grade / graduation-year model ──────────────────────────────────────────────
// Grade 12 graduates this calendar year (matches lib/gradYear.ts convention).

const THIS_YEAR = new Date().getFullYear();
const GRADE_TO_YEAR: Record<string, number> = {
  "12": THIS_YEAR, "11": THIS_YEAR + 1, "10": THIS_YEAR + 2, "9": THIS_YEAR + 3,
  "8": THIS_YEAR + 4, "7": THIS_YEAR + 5, "6": THIS_YEAR + 6, "5": THIS_YEAR + 7,
  "4": THIS_YEAR + 8, "3": THIS_YEAR + 9, "2": THIS_YEAR + 10, "1": THIS_YEAR + 11,
  "K": THIS_YEAR + 12,
};
const UPPER_SCHOOL_GRADES = ["9", "10", "11", "12"];
const LOWER_SCHOOL_GRADES = ["K", "1", "2", "3", "4", "5"];
const ALL_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

// ─── Tables this seed owns (delete-then-reinsert, always scoped to one org) ────

const TENANT_TABLES_DELETE_ORDER = [
  "messages",       // cascades message_recipients
  "people",         // cascades person_tags, relationships (person_id/related_person_id)
  "groups",         // cascades group_tags
  "tags",
  "import_jobs",
  "imports",
] as const;

export async function clearOrgData(supabase: SupabaseClient, orgId: string): Promise<void> {
  for (const table of TENANT_TABLES_DELETE_ORDER) {
    const { error } = await supabase.from(table).delete().eq("org_id", orgId);
    if (error) throw new Error(`clearOrgData: failed to clear ${table} for org ${orgId}: ${error.message}`);
  }
  // relationships also carries org_id directly (belt-and-suspenders; people
  // delete above already cascades it via person_id/related_person_id FKs)
  await supabase.from("relationships").delete().eq("org_id", orgId);
}

// ─── Branding / settings ────────────────────────────────────────────────────────

export async function seedSettings(supabase: SupabaseClient, orgId: string): Promise<void> {
  const rows: { org_id: string; key: string; value: string }[] = [
    { key: "school_name", value: "Riverside Academy" },
    { key: "school_logo_url", value: "" }, // none set — app renders a clean "RA" initials mark
    { key: "primary_color", value: "#1b4332" }, // forest green — generic, professional, distinct from Heichal's navy
    { key: "website_url", value: "https://www.riversideacademy.example" },
    { key: "footer_text", value: "Riverside Academy · Independent Private School · Cedar Grove, New Jersey" },
    { key: "reply_to_email", value: "office@riversideacademy.example" },
    { key: "sender_name", value: "Riverside Academy" },
    { key: "sender_email", value: "office@riversideacademy.example" },
    // Not read by lib/settings.ts's KEY_MAP — read by lib/org.ts's isDemoOrg().
    // Blocks real SMS/email/WhatsApp sends for this org; see lib/org.ts.
    { key: "demo_mode", value: "true" },
  ].map((r) => ({ org_id: orgId, ...r }));

  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "org_id,key" });
  if (error) throw new Error(`seedSettings failed: ${error.message}`);
}

// ─── People + families ──────────────────────────────────────────────────────────

type SeededPerson = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  categories: string[];
  graduation_year: number | null;
  grade: string | null;
};

type FamilyUnit = {
  parents: SeededPerson[];
  kids: SeededPerson[];
  grandparents: SeededPerson[];
};

async function insertPerson(
  supabase: SupabaseClient,
  orgId: string,
  p: {
    first_name: string; last_name: string; email?: string | null; phone?: string | null;
    categories: string[]; graduation_year?: number | null; grade?: string | null;
    address?: string | null; notes?: string | null; parent_role?: "mom" | "dad" | null;
    gender?: "male" | "female"; salutation?: string | null;
  }
): Promise<SeededPerson> {
  const { data, error } = await supabase
    .from("people")
    .insert({
      org_id: orgId,
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? null,
      phone: p.phone ?? null,
      categories: p.categories,
      graduation_year: p.graduation_year ?? null,
      grade: p.grade ?? null,
      address: p.address ?? null,
      notes: p.notes ?? null,
      parent_role: p.parent_role ?? null,
      gender: p.gender ?? "unknown",
      salutation: p.salutation ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`insertPerson(${p.first_name} ${p.last_name}) failed: ${error?.message}`);
  return {
    id: data.id,
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email ?? null,
    phone: p.phone ?? null,
    categories: p.categories,
    graduation_year: p.graduation_year ?? null,
    grade: p.grade ?? null,
  };
}

async function seedFamilies(supabase: SupabaseClient, orgId: string, count: number): Promise<FamilyUnit[]> {
  const surnames = pickN(FAMILY_LAST, count);
  const families: FamilyUnit[] = [];

  for (const last of surnames) {
    const homeAddress = address();
    const numKids = rand(1, 3);
    const grades = pickN(ALL_GRADES, numKids);

    const kids: SeededPerson[] = [];
    for (const grade of grades) {
      const isMale = chance(0.5);
      const first = pick(isMale ? MALE_FIRST : FEMALE_FIRST);
      kids.push(
        await insertPerson(supabase, orgId, {
          first_name: first,
          last_name: last,
          email: email(first, last),
          phone: phone(),
          categories: ["student"],
          graduation_year: GRADE_TO_YEAR[grade],
          grade,
          address: homeAddress,
          gender: isMale ? "male" : "female",
        })
      );
    }

    const parents: SeededPerson[] = [];
    const numParents = chance(0.85) ? 2 : 1;
    if (numParents >= 1) {
      const momFirst = pick(FEMALE_FIRST);
      parents.push(
        await insertPerson(supabase, orgId, {
          first_name: momFirst,
          last_name: last,
          email: email(momFirst, last),
          phone: phone(),
          categories: ["parent"],
          address: homeAddress,
          parent_role: "mom",
          gender: "female",
          salutation: "Mrs.",
          notes: `Parent of: ${kids.map((k) => `${k.first_name} ${k.last_name}`).join(", ")}`,
        })
      );
    }
    if (numParents >= 2) {
      const dadFirst = pick(MALE_FIRST);
      parents.push(
        await insertPerson(supabase, orgId, {
          first_name: dadFirst,
          last_name: last,
          email: email(dadFirst, last),
          phone: phone(),
          categories: ["parent"],
          address: homeAddress,
          parent_role: "dad",
          gender: "male",
          salutation: "Mr.",
          notes: `Parent of: ${kids.map((k) => `${k.first_name} ${k.last_name}`).join(", ")}`,
        })
      );
    }

    const grandparents: SeededPerson[] = [];
    if (chance(0.4)) {
      const gpIsMale = chance(0.5);
      const gpFirst = pick(gpIsMale ? MALE_FIRST : FEMALE_FIRST);
      grandparents.push(
        await insertPerson(supabase, orgId, {
          first_name: gpFirst,
          last_name: last,
          email: chance(0.6) ? email(gpFirst, last) : null,
          phone: phone(),
          categories: ["grandparent"],
          address: chance(0.5) ? homeAddress : address(),
          gender: gpIsMale ? "male" : "female",
          salutation: gpIsMale ? "Mr." : "Mrs.",
        })
      );
    }

    families.push({ parents, kids, grandparents });
  }

  return families;
}

async function seedStandalonePeople(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ faculty: SeededPerson[]; staff: SeededPerson[]; alumni: SeededPerson[]; board: SeededPerson[]; prospects: SeededPerson[] }> {
  const lastPool = pickN(STANDALONE_LAST, STANDALONE_LAST.length);
  let li = 0;
  const nextLast = () => lastPool[li++ % lastPool.length];

  const FACULTY_ROLES = [
    "Upper School Math Teacher", "Lower School Homeroom Teacher", "Science Department Chair",
    "English Teacher, Grades 9–10", "History Teacher, Upper School", "World Languages Teacher (Spanish)",
    "Middle School Science Teacher", "Art Teacher", "Music Director", "Athletic Director & PE Teacher",
    "Learning Specialist", "Librarian & Media Coordinator",
  ];
  const STAFF_ROLES = [
    "Director of Admissions", "Business Office Manager", "Facilities Manager",
    "School Nurse", "Director of Communications", "Registrar",
  ];
  const BOARD_NOTES = [
    "Board Chair", "Board Member, Finance Committee", "Board Member, Development Committee",
    "Board Member, Governance Committee", "Board Vice Chair", "Board Member, Buildings & Grounds",
  ];
  const PROSPECT_NOTES = [
    "Touring for Fall enrollment — interested in Kindergarten",
    "Inquiry via website — interested in Grade 6",
    "Applied for Grade 9 — financial aid inquiry",
    "Attended Fall Open House — interested in Grade 2",
    "Scheduled shadow day — interested in Grade 10",
    "Referred by current family — interested in Pre-K",
    "Applied for Grade 7",
    "Attended Admissions info session — interested in Grade 3",
  ];

  async function person(categories: string[], notes?: string) {
    const isMale = chance(0.5);
    const first = pick(isMale ? MALE_FIRST : FEMALE_FIRST);
    const last = nextLast();
    return insertPerson(supabase, orgId, {
      first_name: first,
      last_name: last,
      email: email(first, last),
      phone: phone(),
      categories,
      address: address(),
      gender: isMale ? "male" : "female",
      salutation: isMale ? "Mr." : "Mrs.",
      notes,
    });
  }

  const faculty: SeededPerson[] = [];
  for (const role of FACULTY_ROLES) faculty.push(await person(["faculty"], role));

  const staff: SeededPerson[] = [];
  for (const role of STAFF_ROLES) staff.push(await person(["staff"], role));

  const alumni: SeededPerson[] = [];
  for (let i = 0; i < 10; i++) {
    const gradYear = THIS_YEAR - rand(1, 12);
    const p = await person(["alumni"]);
    alumni.push({ ...p, graduation_year: gradYear });
    await supabase.from("people").update({ graduation_year: gradYear, notes: `Class of ${gradYear}` }).eq("id", p.id);
  }

  const board: SeededPerson[] = [];
  for (const note of BOARD_NOTES) board.push(await person(["board"], note));

  const prospects: SeededPerson[] = [];
  for (const note of PROSPECT_NOTES) prospects.push(await person(["prospect"], note));

  return { faculty, staff, alumni, board, prospects };
}

// ─── Relationships ──────────────────────────────────────────────────────────────

async function insertRelationships(
  supabase: SupabaseClient,
  orgId: string,
  families: FamilyUnit[]
): Promise<number> {
  const rows: { org_id: string; person_id: string; related_person_id: string; relationship_type: string }[] = [];

  for (const fam of families) {
    const { parents, kids, grandparents } = fam;
    // parent <-> child
    for (const parent of parents) {
      const role = parent === parents[0] ? "Mother" : "Father"; // seeding order: mom pushed first, dad second
      for (const kid of kids) {
        rows.push({ org_id: orgId, person_id: parent.id, related_person_id: kid.id, relationship_type: parents.length === 1 ? "Parent" : role });
        rows.push({ org_id: orgId, person_id: kid.id, related_person_id: parent.id, relationship_type: "Child" });
      }
    }
    // spouses
    if (parents.length === 2) {
      rows.push({ org_id: orgId, person_id: parents[0].id, related_person_id: parents[1].id, relationship_type: "Spouse" });
      rows.push({ org_id: orgId, person_id: parents[1].id, related_person_id: parents[0].id, relationship_type: "Spouse" });
    }
    // grandparent -> grandchild (one-directional, matches the app's relationship-type vocabulary)
    for (const gp of grandparents) {
      for (const kid of kids) {
        rows.push({ org_id: orgId, person_id: gp.id, related_person_id: kid.id, relationship_type: "Grandparent" });
      }
    }
    // siblings
    for (let i = 0; i < kids.length; i++) {
      for (let j = 0; j < kids.length; j++) {
        if (i !== j) rows.push({ org_id: orgId, person_id: kids[i].id, related_person_id: kids[j].id, relationship_type: "Sibling" });
      }
    }
  }

  if (rows.length === 0) return 0;
  const { error } = await supabase.from("relationships").insert(rows);
  if (error) throw new Error(`insertRelationships failed: ${error.message}`);
  return rows.length;
}

// ─── Tags + custom audiences (tag-based, so Compose actually resolves them) ────

async function insertTag(supabase: SupabaseClient, orgId: string, name: string): Promise<string> {
  const { data, error } = await supabase.from("tags").insert({ org_id: orgId, name }).select("id").single();
  if (error || !data) throw new Error(`insertTag(${name}) failed: ${error?.message}`);
  return data.id;
}

async function tagPeople(supabase: SupabaseClient, tagId: string, personIds: string[]): Promise<void> {
  if (personIds.length === 0) return;
  const rows = personIds.map((person_id) => ({ person_id, tag_id: tagId }));
  const { error } = await supabase.from("person_tags").insert(rows);
  if (error) throw new Error(`tagPeople failed: ${error.message}`);
}

async function createGroup(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
  description: string,
  tagId: string
): Promise<void> {
  const { data: group, error } = await supabase
    .from("groups")
    .insert({ org_id: orgId, name, description, is_dynamic: false, filter_config: null })
    .select("id")
    .single();
  if (error || !group) throw new Error(`createGroup(${name}) failed: ${error?.message}`);
  const { error: linkError } = await supabase.from("group_tags").insert({ group_id: group.id, tag_id: tagId });
  if (linkError) throw new Error(`createGroup(${name}) tag link failed: ${linkError.message}`);
}

async function seedAudiences(
  supabase: SupabaseClient,
  orgId: string,
  allFamilies: FamilyUnit[]
): Promise<void> {
  const allKids = allFamilies.flatMap((f) => f.kids);
  const allParents = allFamilies.flatMap((f) => f.parents);

  // Upper School Students (grades 9–12)
  const upperStudents = allKids.filter((k) => k.grade && UPPER_SCHOOL_GRADES.includes(k.grade));
  const upperTag = await insertTag(supabase, orgId, "Upper School Student");
  await tagPeople(supabase, upperTag, upperStudents.map((p) => p.id));
  await createGroup(supabase, orgId, "Upper School Students", "Students in grades 9–12.", upperTag);

  // Lower School Parents (parents with at least one child in grades K–5)
  const lowerFamilies = allFamilies.filter((f) => f.kids.some((k) => k.grade && LOWER_SCHOOL_GRADES.includes(k.grade)));
  const lowerParents = lowerFamilies.flatMap((f) => f.parents);
  const lowerTag = await insertTag(supabase, orgId, "Lower School Parent");
  await tagPeople(supabase, lowerTag, lowerParents.map((p) => p.id));
  await createGroup(supabase, orgId, "Lower School Parents", "Parents of students in grades K–5.", lowerTag);

  // Class of <year> — two graduating cohorts
  for (const offset of [0, 1]) {
    const year = THIS_YEAR + offset;
    const classKids = allKids.filter((k) => k.graduation_year === year);
    const tag = await insertTag(supabase, orgId, `Class of ${year}`);
    await tagPeople(supabase, tag, classKids.map((p) => p.id));
    await createGroup(supabase, orgId, `Class of ${year}`, `Students graduating in ${year}.`, tag);
  }

  // Athletics Families — a subset of families (parents + upper-school kids)
  const athleticsFamilies = pickN(allFamilies, Math.max(6, Math.round(allFamilies.length * 0.4)));
  const athleticsPeople = athleticsFamilies.flatMap((f) => [...f.parents, ...f.kids]);
  const athleticsTag = await insertTag(supabase, orgId, "Athletics Family");
  await tagPeople(supabase, athleticsTag, athleticsPeople.map((p) => p.id));
  await createGroup(supabase, orgId, "Athletics Families", "Families involved in Riverside Athletics.", athleticsTag);

  // Parent Association — a subset of parents
  const paParents = pickN(allParents, Math.max(6, Math.round(allParents.length * 0.25)));
  const paTag = await insertTag(supabase, orgId, "Parent Association");
  await tagPeople(supabase, paTag, paParents.map((p) => p.id));
  await createGroup(supabase, orgId, "Parent Association", "Active Parent Association members and volunteers.", paTag);
}

// ─── Messages / communication history (historical records only — no real sends) ─

type MsgTemplate = {
  channel: "email" | "sms" | "whatsapp";
  subject: string | null;
  body: string;
  audienceLabel: string;
  daysAgoSent: number;
  pickRecipients: (ctx: { allFamilies: FamilyUnit[]; faculty: SeededPerson[]; staff: SeededPerson[]; alumni: SeededPerson[]; board: SeededPerson[] }) => SeededPerson[];
};

const MESSAGE_TEMPLATES: MsgTemplate[] = [
  {
    channel: "email", subject: "Back-to-School Night Reminder",
    body: "We look forward to seeing you at Back-to-School Night this Thursday at 6:30 PM. You'll meet your child's teachers and learn what to expect this year.",
    audienceLabel: "All Parents", daysAgoSent: 42,
    pickRecipients: (ctx) => ctx.allFamilies.flatMap((f) => f.parents),
  },
  {
    channel: "sms", subject: null,
    body: "Reminder: Tomorrow is an early dismissal day. Students will be dismissed at 12:30 PM.",
    audienceLabel: "All Parents", daysAgoSent: 35,
    pickRecipients: (ctx) => ctx.allFamilies.flatMap((f) => f.parents),
  },
  {
    channel: "email", subject: "September Parent Newsletter",
    body: "Welcome back to a new school year! In this issue: a note from the Head of School, fall athletics schedules, and how to get involved with the Parent Association.",
    audienceLabel: "All Parents", daysAgoSent: 30,
    pickRecipients: (ctx) => ctx.allFamilies.flatMap((f) => f.parents),
  },
  {
    channel: "whatsapp", subject: null,
    body: "Riverside Athletics: Bus for Saturday's away game leaves campus at 8:00 AM sharp. Please arrive 15 minutes early.",
    audienceLabel: "Athletics Families", daysAgoSent: 25,
    pickRecipients: (ctx) => pickN(ctx.allFamilies, 8).flatMap((f) => [...f.parents]),
  },
  {
    channel: "sms", subject: null,
    body: "Varsity soccer game has been moved to 4:30 PM today. Same location.",
    audienceLabel: "Athletics Families", daysAgoSent: 21,
    pickRecipients: (ctx) => pickN(ctx.allFamilies, 8).flatMap((f) => [...f.parents]),
  },
  {
    channel: "email", subject: "Riverside Alumni Homecoming Weekend",
    body: "Save the date! Alumni Homecoming Weekend is coming up. Join us for the tailgate, a campus tour, and a chance to reconnect with old classmates.",
    audienceLabel: "Alumni", daysAgoSent: 18,
    pickRecipients: (ctx) => ctx.alumni,
  },
  {
    channel: "whatsapp", subject: null,
    body: "Quick reminder: Picture Day is this Friday. Please have students wear their formal uniform.",
    audienceLabel: "All Parents", daysAgoSent: 15,
    pickRecipients: (ctx) => ctx.allFamilies.flatMap((f) => f.parents),
  },
  {
    channel: "email", subject: "Parent Association Volunteer Opportunities",
    body: "The Parent Association is looking for volunteers for the Fall Book Fair and the Winter Gala. Sign up using the link in this email — every hour helps!",
    audienceLabel: "Parent Association", daysAgoSent: 14,
    pickRecipients: (ctx) => pickN(ctx.allFamilies.flatMap((f) => f.parents), 12),
  },
  {
    channel: "email", subject: "Board Meeting Agenda — Upcoming Session",
    body: "Attached is the agenda for the upcoming Board meeting, including updates from the Finance and Development committees.",
    audienceLabel: "Board Members", daysAgoSent: 7,
    pickRecipients: (ctx) => ctx.board,
  },
  {
    channel: "sms", subject: null,
    body: "Early release today at 12:30 PM due to weather. Please arrange pickup accordingly.",
    audienceLabel: "All Parents", daysAgoSent: 4,
    pickRecipients: (ctx) => ctx.allFamilies.flatMap((f) => f.parents),
  },
  {
    channel: "email", subject: "Class of " + (THIS_YEAR + 1) + " College Counseling Night",
    body: `Parents and students in the Class of ${THIS_YEAR + 1}: join us for College Counseling Night to learn about the application timeline and financial aid process.`,
    audienceLabel: `Class of ${THIS_YEAR + 1}`, daysAgoSent: 2,
    pickRecipients: (ctx) => {
      const kids = ctx.allFamilies.filter((f) => f.kids.some((k) => k.graduation_year === THIS_YEAR + 1));
      return kids.flatMap((f) => [...f.parents, ...f.kids.filter((k) => k.graduation_year === THIS_YEAR + 1)]);
    },
  },
];

async function seedMessages(
  supabase: SupabaseClient,
  orgId: string,
  ctx: { allFamilies: FamilyUnit[]; faculty: SeededPerson[]; staff: SeededPerson[]; alumni: SeededPerson[]; board: SeededPerson[] }
): Promise<void> {
  for (const tmpl of MESSAGE_TEMPLATES) {
    const recipients = tmpl.pickRecipients(ctx).filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);
    const eligible = tmpl.channel === "email" ? recipients.filter((r) => r.email) : recipients.filter((r) => r.phone);
    if (eligible.length === 0) continue;

    const sentAt = daysAgo(tmpl.daysAgoSent);
    const failedCount = chance(0.15) ? rand(1, 2) : 0;
    const sentCount = Math.max(0, eligible.length - failedCount);

    const { data: msg, error: msgError } = await supabase
      .from("messages")
      .insert({
        org_id: orgId,
        subject: tmpl.subject,
        body: tmpl.body,
        channel: tmpl.channel,
        audience_slug: tmpl.audienceLabel.toLowerCase().replace(/\s+/g, "-"),
        audience_label: tmpl.audienceLabel,
        recipient_count: eligible.length,
        sent_count: sentCount,
        failed_count: failedCount,
        status: "sent",
        sent_at: sentAt,
        created_at: sentAt,
      })
      .select("id")
      .single();
    if (msgError || !msg) throw new Error(`seedMessages(${tmpl.subject ?? tmpl.body}) failed: ${msgError?.message}`);

    const recipientRows = eligible.map((r, i) => {
      const failed = i < failedCount;
      const isEmail = tmpl.channel === "email";
      const delivered = !failed && (isEmail ? chance(0.92) : true);
      const opened = isEmail && delivered && chance(0.55);
      return {
        message_id: msg.id,
        person_id: r.id,
        contact_value: (isEmail ? r.email : r.phone)!,
        name: `${r.first_name} ${r.last_name}`,
        status: failed ? "failed" : "sent",
        provider_id: failed ? null : `demo-${crypto.randomUUID()}`,
        sent_at: failed ? null : sentAt,
        delivered_at: delivered ? sentAt : null,
        opened_at: opened ? daysAgo(Math.max(0, tmpl.daysAgoSent - 1)) : null,
        error_detail: failed ? "Simulated demo bounce" : null,
      };
    });

    const { error: recipError } = await supabase.from("message_recipients").insert(recipientRows);
    if (recipError) throw new Error(`seedMessages recipients insert failed: ${recipError.message}`);
  }
}

// ─── Top-level orchestrator ─────────────────────────────────────────────────────

export async function seedRiverside(supabase: SupabaseClient, orgId: string): Promise<{
  familyCount: number; peopleCount: number; relationshipCount: number; messageCount: number;
}> {
  console.log(`[seedRiverside] clearing existing tenant data for org ${orgId}...`);
  await clearOrgData(supabase, orgId);

  console.log(`[seedRiverside] writing branding + demo_mode settings...`);
  await seedSettings(supabase, orgId);

  console.log(`[seedRiverside] seeding families...`);
  const families = await seedFamilies(supabase, orgId, 22);

  console.log(`[seedRiverside] seeding faculty/staff/alumni/board/prospects...`);
  const { faculty, staff, alumni, board, prospects } = await seedStandalonePeople(supabase, orgId);

  console.log(`[seedRiverside] seeding relationships...`);
  const relCount = await insertRelationships(supabase, orgId, families);

  console.log(`[seedRiverside] seeding tag-based audiences...`);
  await seedAudiences(supabase, orgId, families);

  console.log(`[seedRiverside] seeding message history...`);
  await seedMessages(supabase, orgId, { allFamilies: families, faculty, staff, alumni, board });

  const peopleCount =
    families.reduce((n, f) => n + f.parents.length + f.kids.length + f.grandparents.length, 0) +
    faculty.length + staff.length + alumni.length + board.length + prospects.length;

  console.log(`[seedRiverside] done. families=${families.length} people=${peopleCount} relationships=${relCount}`);

  return { familyCount: families.length, peopleCount, relationshipCount: relCount, messageCount: MESSAGE_TEMPLATES.length };
}
