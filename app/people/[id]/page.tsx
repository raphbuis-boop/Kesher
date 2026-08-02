export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { EditPersonButton, type Tag } from "./EditPersonButton";
import { AddRelationshipButton, type PersonOption } from "./AddRelationshipButton";
import { gradYearLabel } from "@/lib/gradYear";
import { Mail, Smartphone, MessageSquare, ArrowLeft, Hash } from "lucide-react";

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

const CATEGORY_COLORS: Record<string, string> = {
  parent: "bg-violet-50 text-violet-700",
  student: "bg-blue-50 text-blue-700",
  grandparent: "bg-purple-50 text-purple-700",
  alumni: "bg-indigo-50 text-indigo-700",
  faculty: "bg-amber-50 text-amber-700",
  staff: "bg-orange-50 text-orange-700",
  board: "bg-rose-50 text-rose-700",
  donor: "bg-emerald-50 text-emerald-700",
  prospect: "bg-teal-50 text-teal-700",
};

const CHANNEL_META: Record<string, { label: string; color: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  email: { label: "Email", color: "text-zinc-500", icon: Mail },
  sms: { label: "SMS", color: "text-blue-500", icon: Smartphone },
  whatsapp: { label: "WhatsApp", color: "text-emerald-500", icon: MessageSquare },
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function SectionCard({ title, count, children, action }: {
  title: string;
  count?: number;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#e7e7e7] bg-white">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[#0f0f0f]">{title}</h2>
          {count != null && count > 0 && (
            <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[#71717a]">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | number | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">{label}</dt>
      <dd className={`mt-1 text-[13px] ${mono ? "font-mono" : ""} text-[#0f0f0f]`}>
        {value !== null && value !== "" ? (
          String(value)
        ) : (
          <span className="text-[#d4d4d8]">—</span>
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

  const isOptedOut = messageHistory.some((item: any) => item.status === "opted_out");
  const peopleById = new Map(allPeople.map((p) => [p.id, p]));
  const currentTagIds = person.person_tags.map((pt) => pt.tag_id);
  const currentCategories = Array.isArray(person.categories) ? person.categories : [];
  const initials = `${person.first_name[0] ?? ""}${person.last_name[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <Link
            href="/people"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#a1a1aa] hover:text-[#71717a] transition-colors"
          >
            <ArrowLeft size={13} strokeWidth={2} />
            People
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
      </header>

      <div className="mx-auto max-w-3xl px-6 py-6 space-y-4">
        {/* Profile header */}
        <div className="rounded-xl border border-[#e7e7e7] bg-white px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-[13px] font-semibold text-[#71717a]">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] font-semibold text-[#0f0f0f] tracking-tight leading-tight">
                {person.first_name} {person.last_name}
              </h1>
              <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
                Added {formatDate(person.created_at)}
              </p>
              {(currentCategories.length > 0 || isOptedOut) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {currentCategories.map((cat) => (
                    <Link
                      key={cat}
                      href={`/audiences/${CATEGORY_SLUGS[cat] ?? cat}`}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${CATEGORY_COLORS[cat] ?? "bg-[#f5f5f5] text-[#71717a]"}`}
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </Link>
                  ))}
                  {isOptedOut && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      SMS opted out
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <SectionCard title="Contact Information">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Email" value={person.email} />
            <Field label="Phone" value={person.phone} mono />
            <Field label="WhatsApp" value={person.whatsapp} mono />
            <Field label="Address" value={person.address} />
            {person.graduation_year && (
              <Field label="Class" value={gradYearLabel(person.graduation_year)} />
            )}
            {person.organization && (
              <Field label="Organization" value={person.organization} />
            )}
          </dl>
        </SectionCard>

        {/* Communication History */}
        <SectionCard title="Communication History" count={messageHistory.length}>
          {messageHistory.length > 0 ? (
            <div className="divide-y divide-[#f5f5f5]">
              {messageHistory.map((item: any) => {
                const msg = item.messages;
                const date = item.sent_at ?? msg?.sent_at;
                const ch = msg?.channel ?? "email";
                const meta = CHANNEL_META[ch] ?? CHANNEL_META.email;
                const ChannelIcon = meta.icon;
                const title = msg?.subject ?? (msg?.body ? msg.body.slice(0, 60) + (msg.body.length > 60 ? "…" : "") : "—");
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#fafafa] border border-[#f0f0f0]">
                      <ChannelIcon size={12} className={meta.color} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0f0f0f] truncate">{title}</p>
                      <p className="mt-0.5 text-[11px] text-[#a1a1aa]">
                        {meta.label}
                        {msg?.audience_label ? ` · ${msg.audience_label}` : ""}
                        {date ? ` · ${formatDate(date)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {item.status === "sent" || item.status === "delivered" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          <span className="h-1 w-1 rounded-full bg-emerald-500" />Delivered
                        </span>
                      ) : item.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                          <span className="h-1 w-1 rounded-full bg-red-500" />Failed
                        </span>
                      ) : item.status === "opted_out" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                          <span className="h-1 w-1 rounded-full bg-rose-500" />Opted out
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#f5f5f5] px-1.5 py-0.5 text-[10px] font-medium text-[#71717a]">
                          {item.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fafafa] border border-[#e7e7e7] mb-3">
                <Mail size={16} className="text-[#d4d4d8]" strokeWidth={1.5} />
              </div>
              <p className="text-[12px] text-[#a1a1aa]">No messages sent to this person yet.</p>
            </div>
          )}
        </SectionCard>

        {/* Tags */}
        <SectionCard title="Tags" count={person.person_tags.length}>
          {person.person_tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {person.person_tags.map((pt) => (
                <span
                  key={pt.tag_id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f5] px-2.5 py-1 text-[12px] font-medium text-[#71717a]"
                >
                  <Hash size={10} className="text-[#a1a1aa]" strokeWidth={2} />
                  {pt.tags.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#a1a1aa]">No tags assigned.</p>
          )}
        </SectionCard>

        {/* Relationships */}
        <SectionCard
          title="Relationships"
          count={relationships.length}
          action={<AddRelationshipButton personId={person.id} allPeople={allPeople} />}
        >
          {relationships.length > 0 ? (
            <div className="divide-y divide-[#f5f5f5]">
              {relationships.map((rel) => {
                const related = peopleById.get(rel.related_person_id);
                if (!related) return null;
                return (
                  <div key={rel.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="w-28 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                      {rel.relationship_type}
                    </span>
                    <Link
                      href={`/people/${related.id}`}
                      className="text-[13px] font-medium text-[#0f0f0f] hover:text-[#71717a] transition-colors"
                    >
                      {related.first_name} {related.last_name}
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-[#a1a1aa]">No relationships added yet.</p>
          )}
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Notes">
          {person.notes ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#71717a]">
              {person.notes}
            </p>
          ) : (
            <p className="text-[12px] text-[#a1a1aa]">No notes yet.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
