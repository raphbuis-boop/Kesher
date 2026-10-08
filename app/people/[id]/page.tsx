export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrgId } from "@/lib/org";
import { EditPersonButton, type Tag } from "./EditPersonButton";
import { AddRelationshipButton, type PersonOption } from "./AddRelationshipButton";
import { gradYearLabel } from "@/lib/gradYear";
import { Mail, Smartphone, MessageSquare, ArrowLeft, Hash } from "lucide-react";
import { CATEGORY_BADGE, CATEGORY_BADGE_FALLBACK } from "@/lib/categoryStyles";

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

const CHANNEL_META: Record<string, { label: string; color: string; icon: React.FC<{ size?: number; strokeWidth?: number; className?: string }> }> = {
  email: { label: "Email", color: "text-text-muted", icon: Mail },
  sms: { label: "SMS", color: "text-info", icon: Smartphone },
  whatsapp: { label: "WhatsApp", color: "text-success", icon: MessageSquare },
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
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-text-primary">{title}</h2>
          {count != null && count > 0 && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium tabular-nums text-text-muted">
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
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">{label}</dt>
      <dd className={`mt-1 text-[13px] ${mono ? "font-mono" : ""} text-text-primary`}>
        {value !== null && value !== "" ? (
          String(value)
        ) : (
          <span className="text-text-subtle">—</span>
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
  const orgId = await getOrgId();

  const { id } = await params;

  const [personResult, tagsResult, relationshipsResult, allPeopleResult, messageHistoryResult] =
    await Promise.all([
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, email, phone, whatsapp, address, grade, graduation_year, organization, notes, categories, created_at, person_tags ( tag_id, tags ( id, name ) )"
        )
        .eq("org_id", orgId)
        .eq("id", id)
        .single(),
      supabase.from("tags").select("id, name").eq("org_id", orgId).order("name"),
      supabase
        .from("relationships")
        .select("id, relationship_type, related_person_id")
        .eq("org_id", orgId)
        .eq("person_id", id)
        .order("relationship_type"),
      supabase
        .from("people")
        .select("id, first_name, last_name")
        .eq("org_id", orgId)
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
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-6 py-3.5">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <Link
            href="/people"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-subtle hover:text-text-muted transition-colors"
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
        <div className="rounded-xl border border-border bg-surface px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-text-muted">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] font-semibold text-text-primary tracking-tight leading-tight">
                {person.first_name} {person.last_name}
              </h1>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                Added {formatDate(person.created_at)}
              </p>
              {(currentCategories.length > 0 || isOptedOut) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {currentCategories.map((cat) => (
                    <Link
                      key={cat}
                      href={`/audiences/${CATEGORY_SLUGS[cat] ?? cat}`}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${CATEGORY_BADGE[cat] ?? CATEGORY_BADGE_FALLBACK}`}
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </Link>
                  ))}
                  {isOptedOut && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-cat-rose-tint px-2.5 py-0.5 text-[11px] font-medium text-cat-rose">
                      <span className="h-1.5 w-1.5 rounded-full bg-cat-rose-solid" />
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
            <div className="divide-y divide-border-subtle">
              {messageHistory.map((item: any) => {
                const msg = item.messages;
                const date = item.sent_at ?? msg?.sent_at;
                const ch = msg?.channel ?? "email";
                const meta = CHANNEL_META[ch] ?? CHANNEL_META.email;
                const ChannelIcon = meta.icon;
                const title = msg?.subject ?? (msg?.body ? msg.body.slice(0, 60) + (msg.body.length > 60 ? "…" : "") : "—");
                return (
                  <div key={item.id} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background border border-border-subtle">
                      <ChannelIcon size={12} className={meta.color} strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-primary truncate">{title}</p>
                      <p className="mt-0.5 text-[11px] text-text-subtle">
                        {meta.label}
                        {msg?.audience_label ? ` · ${msg.audience_label}` : ""}
                        {date ? ` · ${formatDate(date)}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {item.status === "sent" || item.status === "delivered" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-1.5 py-0.5 text-[10px] font-medium text-success">
                          <span className="h-1 w-1 rounded-full bg-success-solid" />Delivered
                        </span>
                      ) : item.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-tint px-1.5 py-0.5 text-[10px] font-medium text-danger">
                          <span className="h-1 w-1 rounded-full bg-danger-solid" />Failed
                        </span>
                      ) : item.status === "opted_out" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cat-rose-tint px-1.5 py-0.5 text-[10px] font-medium text-cat-rose">
                          <span className="h-1 w-1 rounded-full bg-cat-rose-solid" />Opted out
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border mb-3">
                <Mail size={16} className="text-text-faint" strokeWidth={1.5} />
              </div>
              <p className="text-[12px] text-text-subtle">No messages sent to this person yet.</p>
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
                  className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-text-muted"
                >
                  <Hash size={10} className="text-text-subtle" strokeWidth={2} />
                  {pt.tags.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-text-subtle">No tags assigned.</p>
          )}
        </SectionCard>

        {/* Relationships */}
        <SectionCard
          title="Relationships"
          count={relationships.length}
          action={<AddRelationshipButton personId={person.id} allPeople={allPeople} />}
        >
          {relationships.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {relationships.map((rel) => {
                const related = peopleById.get(rel.related_person_id);
                if (!related) return null;
                return (
                  <div key={rel.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="w-28 flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                      {rel.relationship_type}
                    </span>
                    <Link
                      href={`/people/${related.id}`}
                      className="text-[13px] font-medium text-text-primary hover:text-text-muted transition-colors"
                    >
                      {related.first_name} {related.last_name}
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-text-subtle">No relationships added yet.</p>
          )}
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Notes">
          {person.notes ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-muted">
              {person.notes}
            </p>
          ) : (
            <p className="text-[12px] text-text-subtle">No notes yet.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
