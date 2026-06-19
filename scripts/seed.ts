/**
 * Kesher seed script — generates realistic Heichal demo data
 * Run: npx tsx scripts/seed.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ─── Load env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("Missing .env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Name pools ───────────────────────────────────────────────────────────────

const MALE_FIRST = [
  "Avraham","Yitzchak","Yaakov","Moshe","Dovid","Shlomo","Yosef","Binyamin",
  "Aharon","Eliyahu","Menachem","Nachman","Pinchas","Reuven","Shimon","Levi",
  "Yehuda","Zevulun","Dan","Gad","Asher","Naftali","Ephraim","Gavriel",
  "Raphael","Uriel","Michael","Daniel","Ezra","Nehemia","Yonatan","Tzvi",
  "Ari","Noam","Eitan","Ilan","Amit","Ori","Tomer","Nir","Boaz","Kobi",
  "Shaul","Gideon","Baruch","Yoav","Oded","Roi","Shai","Itamar","Akiva",
];

const FEMALE_FIRST = [
  "Sarah","Rivka","Rachel","Leah","Miriam","Devorah","Chana","Tamar",
  "Batya","Nechama","Shifra","Puah","Yocheved","Tzippora","Naomi","Rut",
  "Esther","Judith","Dinah","Michal","Avigail","Shlomit","Tzipora","Malka",
  "Adina","Bracha","Chaya","Dina","Elisheva","Faigy","Gittel","Hadassah",
  "Maya","Noa","Shira","Yael","Ayelet","Tal","Gali","Orly","Ronit","Sigal",
  "Tali","Ofra","Limor","Dafna","Einat","Galit","Hila","Inbal",
];

const LAST = [
  "Cohen","Levi","Goldberg","Shapiro","Klein","Friedman","Katz","Rosenberg",
  "Weiss","Schwartz","Blum","Stern","Horowitz","Adler","Berman","Greenberg",
  "Kaplan","Feldman","Rosen","Stein","Weinberg","Gross","Silverman","Rubin",
  "Levy","Mizrahi","Peretz","Ben-David","Azoulay","Biton","Dahan","Cohen-Levi",
  "Berkowitz","Ehrlich","Frankel","Goldman","Haber","Jacobson","Kramer",
  "Landau","Mandel","Nussbaum","Ostrovsky","Perlman","Rabinowitz","Segal",
  "Teitelbaum","Ungar","Wachsman","Zimmer",
];

const STREETS = [
  "Maple St","Oak Ave","Cedar Ln","Birch Rd","Elm St","Pine Ave","Walnut Dr",
  "Cherry Ln","Sunset Blvd","Forest Rd","Valley View Dr","Hillcrest Ave",
  "Park Place","Riverside Dr","Meadow Ln","Summit Rd","Brookside Ave",
];

const CITIES = [
  "Brooklyn, NY","Manhattan, NY","Queens, NY","Teaneck, NJ","Passaic, NJ",
  "Baltimore, MD","Silver Spring, MD","Rockville, MD","Chicago, IL",
  "Los Angeles, CA","Pico-Robertson, CA","Boca Raton, FL","Miami Beach, FL",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(p: number): boolean {
  return Math.random() < p;
}

let emailCounter = 1;
function email(first: string, last: string): string {
  const base = `${first.toLowerCase().replace(/[^a-z]/g, "")}.${last.toLowerCase().replace(/[^a-z]/g, "")}`;
  return `${base}${emailCounter++ > 50 ? rand(1, 99) : ""}@example.com`;
}

function phone(): string {
  return `+1${rand(200, 999)}${rand(200, 999)}${rand(1000, 9999)}`;
}

function address(): string {
  return `${rand(10, 999)} ${pick(STREETS)}, ${pick(CITIES)}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

const TAG_NAMES = [
  "Shabbaton Committee","Gala 2025","Scholarship Family","Board Prospect",
  "Volunteer","Hebrew Speaker","New Family","Legacy Donor","Annual Fund",
  "Building Campaign","PTA","Carpool","After-School Program","Israel Trip",
  "Bar/Bat Mitzvah Year","Learning Disability Support","IEP","Tuition Assistance",
];

// ─── Message templates ────────────────────────────────────────────────────────

type MessageTemplate = {
  channel: "email" | "sms" | "whatsapp";
  subject: string | null;
  body: string;
  audienceSlug: string;
  audienceLabel: string;
  daysAgoSent: number;
};

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    channel: "email",
    subject: "Welcome Back — Elul 5785",
    body: `Dear Heichal Families,\n\nWe are thrilled to welcome you back for the 5785 school year. Our staff has been working hard all summer to prepare an extraordinary year of learning and growth for your children.\n\nOrientation for new families will take place on Sunday at 10am in the main auditorium. Returning families are invited to a meet-and-greet on Monday evening at 7pm.\n\nWe look forward to partnering with you in the sacred work of chinuch.\n\nB'vracha,\nThe Heichal Administration`,
    audienceSlug: "parents",
    audienceLabel: "Parents",
    daysAgoSent: 95,
  },
  {
    channel: "email",
    subject: "Rosh Hashana Greetings from Heichal",
    body: `Dear Friends of Heichal,\n\nAs we approach the Yamim Nora'im, we pause to express our deepest gratitude for your unwavering support of our school and community.\n\nThis year has been one of remarkable growth — new programs, new families, and new milestones. None of it would be possible without you.\n\nMay you and your families be inscribed for a year of health, happiness, and blessing. L'Shana Tova U'Metuka.\n\nWith warmth and appreciation,\nRabbi Moshe Goldberg\nHead of School`,
    audienceSlug: "parents",
    audienceLabel: "Parents",
    daysAgoSent: 70,
  },
  {
    channel: "email",
    subject: "Annual Gala — Save the Date",
    body: `Dear Heichal Supporters,\n\nWe are delighted to announce that the Heichal Annual Gala will take place on the 15th of Kislev at the Grand Ballroom of the Marriott.\n\nThis year's theme is "Building Tomorrow" in honor of our capital campaign for the new STEM wing. We have an incredible evening planned, including a tribute to our founding families and a special performance by the student choir.\n\nTables and individual seats are available. Early bird pricing ends November 1st.\n\nTo reserve your seat, please reply to this email or contact the development office.\n\nWe hope to see you there.`,
    audienceSlug: "donors",
    audienceLabel: "Donors",
    daysAgoSent: 55,
  },
  {
    channel: "sms",
    subject: null,
    body: "Heichal reminder: Parent-teacher conferences are THIS Thursday and Friday. Book your slot at heichal.edu/conferences. Questions? Reply to this message.",
    audienceSlug: "parents",
    audienceLabel: "Parents",
    daysAgoSent: 45,
  },
  {
    channel: "email",
    subject: "Important: Winter Break Schedule & Chanukkah Celebration",
    body: `Dear Parents,\n\nA few important dates as we head into the winter season:\n\nChanukkah Celebration: Wednesday, December 27th at 6pm. All families are invited to join us in the school gymnasium for our annual Chanukkah chagiga, featuring student performances, a menorah lighting, and sufganiyot.\n\nWinter Break: School will be closed December 28th through January 5th. We resume on Monday, January 6th.\n\nSecond semester tuition statements will be sent home with students on December 22nd.\n\nPlease don't hesitate to reach out with any questions. Wishing your families a warm and joyful Chanukkah.`,
    audienceSlug: "parents",
    audienceLabel: "Parents",
    daysAgoSent: 30,
  },
  {
    channel: "email",
    subject: "Faculty Professional Development Day — January 9",
    body: `Dear Faculty and Staff,\n\nPlease be reminded that Thursday, January 9th is a professional development day. There is no school for students.\n\nWe will gather in the main beit midrash at 8:30am. The morning will feature a keynote by Dr. Shira Adler on differentiated instruction, followed by department breakout sessions in the afternoon.\n\nLunch will be provided. Please confirm your attendance by replying to this email.\n\nLooking forward to a meaningful day together.`,
    audienceSlug: "faculty",
    audienceLabel: "Faculty",
    daysAgoSent: 20,
  },
  {
    channel: "whatsapp",
    subject: null,
    body: "📚 Heichal seniors — Israel trip deposits are due by Friday! Spots are filling up fast. Contact Mrs. Friedman in the main office to secure your place. Don't miss out on this amazing experience!",
    audienceSlug: "students",
    audienceLabel: "Students",
    daysAgoSent: 14,
  },
  {
    channel: "email",
    subject: "Board Meeting Minutes — December 2024",
    body: `Dear Board Members,\n\nThank you for your participation in last week's board meeting. Please find below the key decisions and action items:\n\n1. Capital Campaign Update: We have raised $2.1M toward our $3M goal for the new STEM wing. The building committee will present architectural renderings at the January meeting.\n\n2. Budget Review: The finance committee approved mid-year budget adjustments. Full details are available in the attached report.\n\n3. New Board Member: We are pleased to welcome Dr. Esther Katz to the board, effective January 1st.\n\n4. Strategic Planning Retreat: Scheduled for February 15-16. All board members are asked to hold these dates.\n\nThe full minutes will be circulated for approval at the next meeting. Please reach out with any questions.`,
    audienceSlug: "board",
    audienceLabel: "Board",
    daysAgoSent: 10,
  },
  {
    channel: "email",
    subject: "Kesher: Alumni Shabbaton Recap",
    body: `Dear Heichal Alumni,\n\nWhat a beautiful Shabbat we shared together. Over 80 alumni gathered at the school for our annual Shabbaton, many traveling from across the country to reconnect with classmates and teachers.\n\nHighlights included a panel discussion on "Torah and Career" featuring five alumni in medicine, law, business, and education, and a heartfelt Friday night dinner where Rabbi Stern shared memories from the school's founding years.\n\nPhotos will be shared in the Heichal Alumni newsletter next week.\n\nThank you to everyone who joined us. We hope to see even more of you next year.`,
    audienceSlug: "alumni",
    audienceLabel: "Alumni",
    daysAgoSent: 6,
  },
  {
    channel: "sms",
    subject: null,
    body: "Heichal: Tomorrow is picture day! Students should arrive in Shabbos dress. Makeup photos for absent students will be Feb 18.",
    audienceSlug: "parents",
    audienceLabel: "Parents",
    daysAgoSent: 3,
  },
];

// ─── Main seed ────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Seeding Heichal demo data...\n");

  // ── 1. Clear existing data ────────────────────────────────────────────────
  console.log("Clearing existing data...");
  await supabase.from("message_recipients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("person_tags").delete().neq("person_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("relationships").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("people").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("tags").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("  ✓ Cleared\n");

  // ── 2. Tags ───────────────────────────────────────────────────────────────
  console.log("Creating tags...");
  const { data: tagRows } = await supabase
    .from("tags")
    .insert(TAG_NAMES.map((name) => ({ name })))
    .select("id, name");
  const tags = tagRows ?? [];
  const tagByName = new Map(tags.map((t) => [t.name, t.id]));
  console.log(`  ✓ ${tags.length} tags\n`);

  // ── 3. People ─────────────────────────────────────────────────────────────
  console.log("Creating 150 contacts...");

  const peopleToInsert: any[] = [];

  // Students: grades K–12, ages ~5–18
  const grades = ["K","1","2","3","4","5","6","7","8","9","10","11","12"];
  const studentCount = 52;
  for (let i = 0; i < studentCount; i++) {
    const isMale = chance(0.5);
    const firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const lastName = pick(LAST);
    const grade = pick(grades);
    const gradYear = 2025 + (12 - grades.indexOf(grade));
    peopleToInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: chance(0.3) ? email(firstName, lastName) : null,
      phone: chance(0.4) ? phone() : null,
      grade,
      graduation_year: gradYear,
      categories: ["student"],
      notes: null,
    });
  }

  // Parents: pairs sharing last names, most have email + phone
  const parentCount = 40;
  for (let i = 0; i < parentCount; i++) {
    const lastName = pick(LAST);
    const isMale = chance(0.5);
    const firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const cats: string[] = ["parent"];
    if (chance(0.08)) cats.push("donor");
    if (chance(0.04)) cats.push("board");
    peopleToInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: chance(0.92) ? email(firstName, lastName) : null,
      phone: chance(0.85) ? phone() : null,
      address: chance(0.6) ? address() : null,
      categories: cats,
      notes: null,
    });
  }

  // Faculty: 20 staff members
  const titles = ["Rabbi","Mrs.","Mr.","Dr.","Ms."];
  for (let i = 0; i < 20; i++) {
    const isMale = chance(0.55);
    const firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const lastName = pick(LAST);
    const cats: string[] = ["faculty"];
    if (chance(0.15)) cats.push("staff");
    if (chance(0.1)) cats.push("alumni");
    peopleToInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: email(firstName, lastName),
      phone: chance(0.7) ? phone() : null,
      organization: "Heichal Day School",
      categories: cats,
      notes: chance(0.3) ? pick(["Department head","Long-term faculty","New hire this year","Teaching assistant"]) : null,
    });
  }

  // Grandparents: 10
  for (let i = 0; i < 10; i++) {
    const isMale = chance(0.5);
    const firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const lastName = pick(LAST);
    peopleToInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: chance(0.6) ? email(firstName, lastName) : null,
      phone: chance(0.75) ? phone() : null,
      categories: ["grandparent"],
      address: chance(0.5) ? address() : null,
      notes: null,
    });
  }

  // Alumni: 12
  const alumniGradYears = [1998,2001,2004,2006,2008,2010,2012,2013,2015,2017,2019,2021,2022];
  for (let i = 0; i < 12; i++) {
    const isMale = chance(0.5);
    const firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const lastName = pick(LAST);
    const cats: string[] = ["alumni"];
    if (chance(0.25)) cats.push("donor");
    peopleToInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: chance(0.85) ? email(firstName, lastName) : null,
      phone: chance(0.65) ? phone() : null,
      graduation_year: pick(alumniGradYears),
      categories: cats,
      notes: null,
    });
  }

  // Board: 8 members
  for (let i = 0; i < 8; i++) {
    const isMale = chance(0.6);
    const firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const lastName = pick(LAST);
    const cats: string[] = ["board"];
    if (chance(0.7)) cats.push("donor");
    if (chance(0.3)) cats.push("parent");
    peopleToInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: email(firstName, lastName),
      phone: phone(),
      organization: chance(0.7) ? pick(["Goldberg Capital","Stern Law Group","Friedman & Associates","Rosen Real Estate","Klein Medical Group"]) : null,
      categories: cats,
      notes: chance(0.4) ? pick(["Board chair","Treasurer","Secretary","Founding board member","Chair of building committee"]) : null,
    });
  }

  // Donors (not already parents/board): 8
  for (let i = 0; i < 8; i++) {
    const isMale = chance(0.55);
    const firstName = isMale ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
    const lastName = pick(LAST);
    peopleToInsert.push({
      first_name: firstName,
      last_name: lastName,
      email: email(firstName, lastName),
      phone: chance(0.8) ? phone() : null,
      categories: ["donor"],
      notes: chance(0.3) ? pick(["Annual fund donor","Building campaign","Scholarship endowment","In memory of"]) : null,
    });
  }

  // Insert in a single batch, then re-fetch to get the full rows including categories
  const { error: peopleError } = await supabase
    .from("people")
    .insert(peopleToInsert);

  if (peopleError) {
    console.error("Error inserting people:", peopleError);
    process.exit(1);
  }

  const { data: insertedPeople } = await supabase
    .from("people")
    .select("id, categories, email, phone")
    .order("created_at", { ascending: false })
    .limit(200);

  const people = insertedPeople ?? [];
  console.log(`  ✓ ${people.length} contacts\n`);

  // ── 4. Person tags ────────────────────────────────────────────────────────
  console.log("Assigning tags...");

  const personTagInserts: { person_id: string; tag_id: string }[] = [];

  const committeeTagId = tagByName.get("Shabbaton Committee");
  const galaTagId = tagByName.get("Gala 2025");
  const scholarshipTagId = tagByName.get("Scholarship Family");
  const volunteerTagId = tagByName.get("Volunteer");
  const newFamilyTagId = tagByName.get("New Family");
  const legacyTagId = tagByName.get("Legacy Donor");
  const annualFundTagId = tagByName.get("Annual Fund");
  const ptaTagId = tagByName.get("PTA");
  const israelTripTagId = tagByName.get("Israel Trip");
  const bmYearTagId = tagByName.get("Bar/Bat Mitzvah Year");
  const tuitionTagId = tagByName.get("Tuition Assistance");

  for (const p of people) {
    const cats = (p.categories ?? []) as string[];
    const assigned = new Set<string>();

    const addTag = (id: string | undefined) => {
      if (id && !assigned.has(id)) { assigned.add(id); personTagInserts.push({ person_id: p.id, tag_id: id }); }
    };

    if (cats.includes("parent")) {
      if (chance(0.2)) addTag(committeeTagId);
      if (chance(0.35)) addTag(galaTagId);
      if (chance(0.15)) addTag(scholarshipTagId);
      if (chance(0.25)) addTag(volunteerTagId);
      if (chance(0.1)) addTag(newFamilyTagId);
      if (chance(0.3)) addTag(ptaTagId);
      if (chance(0.12)) addTag(tuitionTagId);
    }
    if (cats.includes("donor")) {
      if (chance(0.5)) addTag(galaTagId);
      if (chance(0.4)) addTag(annualFundTagId);
      if (chance(0.2)) addTag(legacyTagId);
    }
    if (cats.includes("student")) {
      if (chance(0.3)) addTag(israelTripTagId);
      if (chance(0.15)) addTag(bmYearTagId);
    }
    if (cats.includes("board")) {
      addTag(galaTagId);
      if (chance(0.6)) addTag(annualFundTagId);
    }
  }

  if (personTagInserts.length > 0) {
    await supabase.from("person_tags").insert(personTagInserts);
  }
  console.log(`  ✓ ${personTagInserts.length} tag assignments\n`);

  // ── 5. Custom audience groups ─────────────────────────────────────────────
  console.log("Creating custom audience groups...");

  // Gala 2025 group
  const { data: galaGroup } = await supabase
    .from("groups")
    .insert({ name: "Gala 2025 Attendees" })
    .select("id")
    .single();

  if (galaGroup && galaTagId) {
    await supabase.from("group_tags").insert({ group_id: galaGroup.id, tag_id: galaTagId });
  }

  // Shabbaton Committee
  const { data: shabbatonGroup } = await supabase
    .from("groups")
    .insert({ name: "Shabbaton Committee" })
    .select("id")
    .single();

  if (shabbatonGroup && committeeTagId) {
    await supabase.from("group_tags").insert({ group_id: shabbatonGroup.id, tag_id: committeeTagId });
  }

  // Israel Trip Students
  const { data: israelGroup } = await supabase
    .from("groups")
    .insert({ name: "Israel Trip 2025" })
    .select("id")
    .single();

  if (israelGroup && israelTripTagId) {
    await supabase.from("group_tags").insert({ group_id: israelGroup.id, tag_id: israelTripTagId });
  }

  console.log("  ✓ 3 custom groups\n");

  // ── 6. Messages + recipients ──────────────────────────────────────────────
  console.log("Creating message history...");

  const CATEGORY_MAP: Record<string, string> = {
    parents: "parent", students: "student", grandparents: "grandparent",
    alumni: "alumni", faculty: "faculty", staff: "staff",
    board: "board", donors: "donor", prospects: "prospect",
  };

  let totalMessages = 0;
  let totalRecipients = 0;

  for (const tmpl of MESSAGE_TEMPLATES) {
    const sentAt = daysAgo(tmpl.daysAgoSent);
    const category = CATEGORY_MAP[tmpl.audienceSlug];

    // Find eligible recipients
    const eligible = people.filter((p) => {
      const cats = (p.categories ?? []) as string[];
      if (!cats.includes(category)) return false;
      if (tmpl.channel === "email") return !!p.email;
      return !!p.phone;
    });

    if (eligible.length === 0) { console.log(`  ⚠ No eligible recipients for ${tmpl.audienceSlug}/${tmpl.channel} (people sample categories: ${people.slice(0,3).map(p => JSON.stringify(p.categories)).join(', ')})`); continue; }

    const { data: msgRow, error: msgErr } = await supabase
      .from("messages")
      .insert({
        subject: tmpl.subject,
        body: tmpl.body,
        channel: tmpl.channel,
        audience_slug: tmpl.audienceSlug,
        audience_label: tmpl.audienceLabel,
        recipient_count: eligible.length,
        sent_count: eligible.length,
        failed_count: 0,
        status: "sent",
        sent_at: sentAt,
      })
      .select("id")
      .single();

    if (!msgRow) { console.error("  ✗ message insert failed for", tmpl.subject, msgErr?.message); continue; }
    totalMessages++;

    const recipientInserts = eligible.map((p) => ({
      message_id: msgRow.id,
      person_id: p.id,
      contact_value: tmpl.channel === "email" ? p.email! : p.phone!,
      name: "Contact",
      status: "sent",
      provider_id: `seed_${tmpl.channel}_${p.id.slice(0, 8)}`,
      sent_at: sentAt,
    }));

    await supabase.from("message_recipients").insert(recipientInserts);
    totalRecipients += recipientInserts.length;

    console.log(`  ✓ "${tmpl.subject ?? tmpl.body.slice(0, 40)}…" → ${eligible.length} recipients via ${tmpl.channel}`);
  }

  console.log(`\n  ✓ ${totalMessages} messages, ${totalRecipients} recipient records\n`);

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log("─────────────────────────────────────────");
  console.log("✅ Seed complete!\n");
  console.log(`  People:     ${people.length}`);
  console.log(`  Tags:       ${tags.length}`);
  console.log(`  Groups:     3`);
  console.log(`  Messages:   ${totalMessages}`);
  console.log(`  Recipients: ${totalRecipients}`);
  console.log("");
  console.log("Audience breakdown:");

  const catCounts: Record<string, number> = {};
  for (const p of people) {
    for (const cat of (p.categories ?? []) as string[]) {
      catCounts[cat] = (catCounts[cat] ?? 0) + 1;
    }
  }
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(14)} ${count}`);
  }
  console.log("");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
