export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { EditPersonButton, type Tag } from "./EditPersonButton";
import { AddRelationshipButton, type PersonOption } from "./AddRelationshipButton";
import { gradYearLabel } from "@/lib/gradYear";

const CATEGORY_LABELS: Record<string, string> = {
  parent: "Parents",
  student: "Students",
  grandparent: "Grandparents",
  alumni: "Alumni",
  faculty: "Faculty",
  staff: "Staff",
  board: "Board",
  donor: "Donors",
  prospect: "Prospects",
};

const CATEGORY_SLUGS: Record<string, string> = {
  parent: "parents",
  student: "students",
  grandparent: "grandparents",
  alumni: "alumni",
  faculty: "faculty",
  staff: "staff",
  board: "board",
  donor: "donors",
  prospect: "prospects",
};

type Person = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  grade: string | null;
  graduation_year: number | null;
  organization: string | null;
  notes: string | null;
  categories: string[] | null;
  created_at: string;
  person_tags: Array<{
    tag_id: string;
    tags: Tag;
  }>;
};

type Relationship = {
  id: string;
  relationship_type: string;
  related_person_id: string;
};

type MessageHistoryItem = {
  id: string;
  subject: string;
  audience_label: string;
  status: string;
  sent_at: string | null;
  message: {
    subject: string;
    audience_label: string;
    sent_at: string | null;
  };
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-zinc-900">
        {value !== null && value !== "" ? (
          String(value)
        ) : (
          <span className="text-zinc-300">—</span>
        )}
      </dd>
    </div>
  );
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();

  const { id } = await params;

  const [personResult, tagsResult, relationshipsResult, allPeopleResult, messageHistoryResult] =
    await Promise.all([
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, email, phone, whatsapp, address, grade, graduation_year, organization, notes, categories, created_at, person_tags ( tag_id, tags ( id, name ) )"
        )
        .eq("id", id)
        .single(),
      supabase.from("tags").select("id, name").order("name"),
      supabase
        .from("relationships")
        .select("id, relationship_type, related_person_id")
        .eq("person_id", id)
        .order("relationship_type"),
      supabase
        .from("people")
        .select("id, first_name, last_name")
        .neq("id", id)
        .order("last_name"),
      supabase
        .from("message_recipients")
        .select("id, status, sent_at, messages ( subject, body, channel, audience_label, sent_at )")
        .eq("person_id", id)
        .order("sent_at", { ascending: false })
        .limit(20),
    ]);

  if (personResult.error || !personResult.data) {
    notFound();
  }

  const person = personResult.data as unknown as Person;
  const allTags = (tagsResult.data ?? []) as Tag[];
  const relationships = (relationshipsResult.data ?? []) as Relationship[];
  const allPeople = (allPeopleResult.data ?? []) as PersonOption[];
  const messageHistory = (messageHistoryResult.data ?? []) as any[];

  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  const currentTagIds = person.person_tags.map((pt) => pt.tag_id);
  const currentCategories = Array.isArray(person.categories)
    ? person.categories
    : [];
  const initials =
    `${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Back + actions bar */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Audiences
          </Link>
          <EditPersonButton
            person={{
              id: person.id,
              first_name: person.first_name,
              last_name: person.last_name,
              email: person.email,
              phone: person.phone,
              whatsapp: person.whatsapp,
              address: person.address,
              grade: person.grade,
              graduation_year: person.graduation_year,
              organization: person.organization,
              notes: person.notes,
              currentTagIds,
              currentCategories,
            }}
            tags={allTags}
          />
        </div>

        {/* Profile header card */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-lg font-semibold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
                {person.first_name} {person.last_name}
              </h1>
              <p className="mt-0.5 text-sm text-zinc-400">
                Added {formatDate(person.created_at)}
              </p>
              {currentCategories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {currentCategories.map((cat) => (
                    <Link
                      key={cat}
                      href={`/audiences/${CATEGORY_SLUGS[cat] ?? cat}`}
                      className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-6 py-6">
          <h2 className="mb-5 text-sm font-semibold text-zinc-900">
            Contact Information
          </h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Email" value={person.email} />
            <Field label="Phone" value={person.phone} />
            <Field label="WhatsApp" value={person.whatsapp} />
            <Field label="Address" value={person.address} />
            {person.graduation_year && (
              <Field label="Class" value={gradYearLabel(person.graduation_year)} />
            )}
            {person.organization && (
              <Field label="Organization" value={person.organization} />
            )}
          </dl>
        </div>

        {/* Communication History — shown prominently before other metadata */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Communication History</h2>
            {messageHistory.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-500">
                {messageHistory.length}
              </span>
            )}
          </div>
          {messageHistory.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {messageHistory.map((item: any) => {
                const msg = item.messages;
                const date = item.sent_at ?? msg?.sent_at;
                const ch = msg?.channel ?? "email";
                const channelColors: Record<string, string> = {
                  email: "bg-zinc-100 text-zinc-600",
                  sms: "bg-blue-50 text-blue-700",
                  whatsapp: "bg-green-50 text-green-700",
                };
                const channelNames: Record<string, string> = {
                  email: "Email",
                  sms: "SMS",
                  whatsapp: "WhatsApp",
                };
                const title = msg?.subject ?? (msg?.body ? msg.body.slice(0, 60) + (msg.body.length > 60 ? "…" : "") : "—");
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                    {/* Channel dot */}
                    <div className={"mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold " + (channelColors[ch] ?? channelColors.email)}>
                      {ch === "email" ? "✉" : ch === "sms" ? "✆" : "W"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{title}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {channelNames[ch] ?? ch}
                        {msg?.audience_label ? ` · ${msg.audience_label}` : ""}
                        {date ? ` · ${formatDate(date)}` : ""}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {item.status === "sent" ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          Delivered
                        </span>
                      ) : item.status === "failed" ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
                <svg className="h-5 w-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="mt-2 text-sm text-zinc-400">No messages sent to this person yet.</p>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-6 py-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Tags</h2>
          {person.person_tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {person.person_tags.map((pt) => (
                <span
                  key={pt.tag_id}
                  className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700"
                >
                  {pt.tags.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No tags assigned.</p>
          )}
        </div>

        {/* Relationships */}
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Relationships</h2>
            <AddRelationshipButton personId={person.id} allPeople={allPeople} />
          </div>
          {relationships.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {relationships.map((rel) => {
                const related = peopleById.get(rel.related_person_id);
                if (!related) return null;
                return (
                  <div key={rel.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="w-28 flex-shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">
                      {rel.relationship_type}
                    </span>
                    <Link
                      href={`/people/${related.id}`}
                      className="text-sm font-medium text-zinc-900 transition-colors hover:text-zinc-500"
                    >
                      {related.first_name} {related.last_name}
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No relationships added yet.</p>
          )}
        </div>

        {/* Notes */}
        <div className="rounded-xl border border-zinc-200 bg-white px-6 py-6">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900">Notes</h2>
          {person.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
              {person.notes}
            </p>
          ) : (
            <p className="text-sm text-zinc-400">No notes yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
