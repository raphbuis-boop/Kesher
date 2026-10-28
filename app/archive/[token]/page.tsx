import type { Metadata } from "next";
import Link from "next/link";
import { FamilyShell } from "@/app/components/FamilyShell";
import { HebrewDate } from "@/app/components/HebrewDate";
import { verifyId } from "@/lib/crypto";
import { ARCHIVE_PAGE_SIZE, getArchive } from "@/lib/archive";
import { buildPreferencesUrl } from "@/lib/links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Past messages", robots: { index: false } };

const CHANNEL = { email: "Email", sms: "Text", whatsapp: "WhatsApp" } as const;

/** Opened from "Past messages" in the footer of an email. No login; the link is for one family. */
export default async function ArchivePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ page?: string }> }) {
  const { token } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const personId = verifyId("archive", token, 7);
  const view = personId ? await getArchive(personId, page) : null;

  if (!view) {
    return (
      <FamilyShell schoolName="">
        <h1 className="mb-2 text-xl font-semibold text-ink">This link isn&apos;t valid</h1>
        <p className="text-[14px] leading-relaxed text-ink-2">Open the &ldquo;Past messages&rdquo; link from a recent email from your school.</p>
      </FamilyShell>
    );
  }

  const prefs = buildPreferencesUrl(view.personId);
  const pages = Math.max(1, Math.ceil(view.total / ARCHIVE_PAGE_SIZE));
  const href = (p: number) => `/archive/${encodeURIComponent(token)}?page=${p}`;

  return (
    <FamilyShell schoolName={view.schoolName} logoUrl={view.logoUrl}>
      <h1 className="mb-1 text-xl font-semibold text-ink">Past messages</h1>
      <p className="mb-6 text-[14px] leading-relaxed text-ink-2">
        Everything {view.schoolName || "the school"} has sent to your family.{prefs && <> <a href={prefs} className="underline">Change how you hear from us</a>.</>}
      </p>

      {!view.enabled ? (
        <p className="rounded-lg border border-line bg-card px-4 py-6 text-[14px] text-ink-2">The school hasn&apos;t made past messages available online. Please contact the office if you need a copy.</p>
      ) : view.messages.length === 0 ? (
        <p className="rounded-lg border border-line bg-card px-4 py-6 text-[14px] text-ink-2">No messages yet. Anything the school sends you will show up here.</p>
      ) : (
        <div className="space-y-4">
          {view.messages.map((m) => (
            <article key={m.id} className="rounded-xl border border-line bg-card px-5 py-4">
              <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 dir="auto" className="text-[15px] font-semibold text-ink">{m.title}</h2>
                <p className="text-[11px] text-ink-3">
                  {new Date(m.sentAt).toLocaleDateString("en-US", { timeZone: view.timezone, month: "short", day: "numeric", year: "numeric" })}
                  <HebrewDate at={m.sentAt} tz={view.timezone} style={view.hebrewStyle} className="text-ink-3" />
                </p>
              </header>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {m.emergency && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Emergency</span>}
                {m.channels.map((c) => <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-2">{CHANNEL[c]}</span>)}
              </div>
              <div className="space-y-2 text-[14px] leading-relaxed text-ink-soft">
                {m.text.split(/\n{2,}/).map((para, i) => (
                  <p key={i} dir="auto" className="whitespace-pre-line">{para}</p>
                ))}
              </div>
              {m.attachments.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-muted pt-3 text-[13px]">
                  {m.attachments.map((u) => (
                    <li key={u}><a href={u} target="_blank" rel="noreferrer" className="text-brand underline">{decodeURIComponent(u.split("/").pop() ?? "Attachment")}</a></li>
                  ))}
                </ul>
              )}
            </article>
          ))}
          {pages > 1 && (
            <nav className="flex items-center justify-between pt-2 text-[13px]">
              {page > 1 ? <Link href={href(page - 1)} className="font-medium text-ink underline">← Newer</Link> : <span />}
              <span className="text-ink-3">Page {page} of {pages}</span>
              {page < pages ? <Link href={href(page + 1)} className="font-medium text-ink underline">Older →</Link> : <span />}
            </nav>
          )}
        </div>
      )}
    </FamilyShell>
  );
}
