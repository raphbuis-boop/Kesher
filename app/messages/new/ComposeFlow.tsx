"use client";

import { toast } from "@/app/components/ui/toast";
import { GlassDropzone, postWithProgress } from "@/app/components/ui/GlassDropzone";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitMessage, previewSend, checkSendWindow, type Channel, type PreviewResult, type SubmitAction, type SubmitResult } from "../actions";
import type { MessageInput } from "@/lib/send/types";
import { WEEKDAY_NAMES, addDays, formatInZone, formatTimeOnly, localDateString, weekdayOf } from "@/lib/schoolTime";
import { describeOffset, zmanimTime, type ZmanimAnchor } from "@/lib/zmanim";
import { TEMPLATE_TOKENS, renderTemplate } from "@/lib/template";
import { FUNDRAISING_WHATSAPP_NOTE, looksLikeFundraising } from "@/lib/fundraising";

export type TemplateOption = { id: string; name: string; defaultSubject: string | null };

/** An existing draft / scheduled / waiting message (or repeating send) being edited. */
export type ComposeInitial = {
  messageId: string | null;
  recurringId: string | null;
  status: string | null;
  rejectionReason: string | null;
  input: MessageInput;
  /** School-local */
  when: { date: string; time: string } | null;
  repeatWeeks: number | null;
  /** A repeating send tied to candle lighting / Havdalah */
  zmanim: { anchor: ZmanimAnchor; offsetMinutes: number } | null;
};

/** A Shabbos or Yom Tov from the school's cached times, for "around Shabbos" scheduling */
export type ZmanimWindowOption = { startsAt: string; endsAt: string; kind: "shabbos" | "yomtov"; label: string | null };

export type AudienceOption = {
  slug: string;
  label: string;
  /** People in the audience right now (students are reached through their parents). */
  totalCount: number;
};

type Attachment = {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
};

const PREVIEW_PERSON = {
  first_name: "Jordan",
  last_name: "Parker",
  preferred_name: "Jordan",
  salutation: "Mx.",
  email: "jordan.parker@example.com",
  graduation_year: new Date().getFullYear() + 4, // ~Grade 8
};

function channelLabel(channel: Channel): string {
  return channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp";
}

function audienceSummary(audiences: AudienceOption[]): string {
  if (audiences.length === 0) return "";
  if (audiences.length === 1) return audiences[0].label;
  if (audiences.length === 2) return `${audiences[0].label} & ${audiences[1].label}`;
  return `${audiences[0].label} +${audiences.length - 1} more`;
}

const SYSTEM_SLUGS = new Set([
  "parents", "students", "grandparents", "alumni", "faculty",
  "staff", "board", "donors", "prospects",
]);

const DOC_RE = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt)$/i;
const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)$/i;

function fileIcon(url: string) {
  if (IMAGE_RE.test(url)) {
    return (
      <svg className="h-3.5 w-3.5 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

// ─── Channel icon ─────────────────────────────────────────────────────────────

function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  if (channel === "email") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    );
  }
  if (channel === "sms") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 15h3" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

// ─── Audience Dropdown ────────────────────────────────────────────────────────

function AudienceDropdown({
  allAudiences,
  selected,
  onToggle,
}: {
  allAudiences: AudienceOption[];
  selected: AudienceOption[];
  onToggle: (a: AudienceOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSlugs = new Set(selected.map((a) => a.slug));

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => searchRef.current?.focus());
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const lq = search.toLowerCase();
  const system = allAudiences.filter(
    (a) => SYSTEM_SLUGS.has(a.slug) && (!lq || a.label.toLowerCase().includes(lq))
  );
  const custom = allAudiences.filter(
    (a) => !SYSTEM_SLUGS.has(a.slug) && (!lq || a.label.toLowerCase().includes(lq))
  );

  const triggerLabel =
    selected.length === 0
      ? "Select recipients…"
      : selected.length === 1
      ? selected[0].label
      : `${selected.length} audiences selected`;

  function AudienceRow({ a }: { a: AudienceOption }) {
    const checked = selectedSlugs.has(a.slug);
    return (
      <button
        type="button"
        onClick={() => onToggle(a)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-canvas"
      >
        <span
          className={
            "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors " +
            (checked
              ? "border-ink bg-ink"
              : "border-line-strong bg-card")
          }
        >
          {checked && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </span>
        <span className="flex-1 text-sm font-medium text-ink">{a.label}</span>
        <span className="text-xs tabular-nums text-ink-3">{a.totalCount.toLocaleString()}</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors " +
          (open
            ? "border-ink-3 bg-card text-ink"
            : selected.length > 0
            ? "border-line-strong bg-card text-ink hover:border-ink-3"
            : "border-line bg-card text-ink-3 hover:border-line-strong hover:text-ink-soft")
        }
      >
        <span className={selected.length > 0 ? "font-medium" : ""}>{triggerLabel}</span>
        <svg
          className={"h-4 w-4 flex-shrink-0 text-ink-3 transition-transform " + (open ? "rotate-180" : "")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-line bg-card shadow-pop animate-pop-in">
          {/* Search */}
          <div className="sticky top-0 border-b border-muted bg-card px-3 py-2">
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audiences…"
                className="w-full rounded-md border border-line bg-canvas py-1.5 pl-8 pr-3 text-sm text-ink placeholder-ink-3 outline-none focus:border-line-strong focus:bg-card"
              />
            </div>
          </div>

          <div className="p-2">
            {system.length > 0 && (
              <div>
                <p className="mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                  Audiences
                </p>
                {system.map((a) => <AudienceRow key={a.slug} a={a} />)}
              </div>
            )}
            {custom.length > 0 && (
              <div className={system.length > 0 ? "mt-2 border-t border-muted pt-2" : ""}>
                <p className="mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                  Groups
                </p>
                {custom.map((a) => <AudienceRow key={a.slug} a={a} />)}
              </div>
            )}
            {system.length === 0 && custom.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-ink-3">No audiences found</p>
            )}
          </div>

          {selected.length > 0 && (
            <div className="sticky bottom-0 border-t border-muted bg-canvas px-3 py-2.5">
              <button
                type="button"
                onClick={() => { setOpen(false); setSearch(""); }}
                className="w-full rounded-md bg-ink py-2 text-sm font-medium text-on-ink transition-colors hover:bg-ink-hover"
              >
                Confirm {selected.length === 1 ? selected[0].label : `${selected.length} audiences`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Preview components ───────────────────────────────────────────────────────

function EmailPreview({
  subject,
  body,
  attachments,
  greetingTemplate,
}: {
  subject: string;
  body: string;
  attachments: Attachment[];
  greetingTemplate: string | null;
}) {
  const rendered = renderTemplate(body, PREVIEW_PERSON);
  const paragraphs = rendered.split(/\n\n+/).filter((p) => p.trim());
  const images = attachments.filter((a) => IMAGE_RE.test(a.url));
  const docs = attachments.filter((a) => !IMAGE_RE.test(a.url));

  // Resolve greeting for preview using the sample person's first name
  const previewGreeting = greetingTemplate
    ? greetingTemplate.replace("{{first_name}}", PREVIEW_PERSON.preferred_name)
    : null;

  return (
    <div className="rounded-xl border border-line bg-canvas p-4">
      <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-ink-3">
        Preview — as {PREVIEW_PERSON.first_name} {PREVIEW_PERSON.last_name} will see it
      </p>
      <div className="mx-auto max-w-[560px] rounded-xl border border-line bg-card px-8 py-6 shadow-sm">
        {subject && (
          <p className="mb-4 border-b border-muted pb-4 text-sm font-semibold text-ink">
            {renderTemplate(subject, PREVIEW_PERSON)}
          </p>
        )}
        {previewGreeting && (
          <p className="mb-4 text-sm font-semibold text-ink">{previewGreeting}</p>
        )}
        {paragraphs.length > 0 ? (
          paragraphs.map((para, i) => (
            <p key={i} className="mb-4 text-sm leading-relaxed text-ink-hover last:mb-0">
              {para.split("\n").map((line, j, arr) => (
                <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
              ))}
            </p>
          ))
        ) : (
          <p className="text-sm italic text-line-strong">Your message will appear here…</p>
        )}
        {images.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-muted pt-4">
            {images.map((a) => (
              <img key={a.url} src={a.url} alt={a.fileName} className="max-w-full rounded-md" />
            ))}
          </div>
        )}
        {docs.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {docs.map((a) => (
              <div key={a.url} className="flex items-center gap-2 rounded-md border border-muted bg-canvas px-3 py-2">
                {fileIcon(a.url)}
                <span className="text-xs text-ink-soft">{a.fileName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SmsPreview({ body }: { body: string }) {
  const rendered = renderTemplate(body, PREVIEW_PERSON);
  return (
    <div className="rounded-xl border border-line bg-muted p-6">
      <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-ink-3">
        Preview — as {PREVIEW_PERSON.first_name} {PREVIEW_PERSON.last_name} will see it
      </p>
      <div className="mx-auto max-w-[280px]">
        {rendered ? (
          <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-line-strong px-4 py-2.5 text-sm leading-relaxed text-ink">
            {rendered}
          </div>
        ) : (
          <p className="text-xs italic text-ink-3">Your message will appear here…</p>
        )}
      </div>
    </div>
  );
}

function WhatsAppPreview({ body, attachments }: { body: string; attachments: Attachment[] }) {
  const rendered = renderTemplate(body, PREVIEW_PERSON);
  const firstImage = attachments.find((a) => IMAGE_RE.test(a.url));
  const docs = attachments.filter((a) => DOC_RE.test(a.url));
  return (
    <div className="rounded-xl border border-line bg-[#e5ddd5] p-6">
      <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-ink-2">
        Preview — as {PREVIEW_PERSON.first_name} {PREVIEW_PERSON.last_name} will see it
      </p>
      <div className="mx-auto max-w-[280px]">
        <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-card px-4 py-2.5 text-sm leading-relaxed text-ink shadow-sm">
          {firstImage && (
            <img src={firstImage.url} alt={firstImage.fileName} className="mb-2 max-w-full rounded-lg" />
          )}
          {docs.length > 0 && (
            <div className="mb-2 space-y-1">
              {docs.map((a) => (
                <div key={a.url} className="flex items-center gap-1.5 rounded bg-canvas px-2 py-1.5 text-xs text-ink-soft">
                  {fileIcon(a.url)}
                  {a.fileName}
                </div>
              ))}
            </div>
          )}
          {rendered || <span className="italic text-ink-3">Your message will appear here…</span>}
          <span className="ml-2 text-[10px] text-ink-3">✓✓</span>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const SELECT_CLS = "rounded-md border border-line bg-card py-1.5 pl-2.5 pr-7 text-xs font-medium text-ink-soft outline-none hover:border-line-strong focus:border-line-strong";

function Toggle({ checked, onChange, children, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; hint?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2 text-xs text-ink-2 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[var(--app-ink)]" />
      <span>
        {children}
        {hint && <span className="mt-0.5 block text-ink-3">{hint}</span>}
      </span>
    </label>
  );
}

function usePreview(input: Parameters<typeof previewSend>[0], enabled: boolean) {
  const [data, setData] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify(input);

  useEffect(() => {
    if (!enabled) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await previewSend(JSON.parse(key));
        if (mine === seq.current) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (mine === seq.current) setError(err instanceof Error ? err.message : "Couldn't work out who this reaches.");
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [key, enabled]);

  return { data: enabled ? data : null, loading, error };
}

export function ComposeFlow({
  audiences,
  initialAudienceSlugs,
  attachmentsEnabled = false,
  templates = [],
  audienceTemplates = {},
  customTokens = [],
  canEmergency = false,
  schoolTimezone,
  confirmLinksReady = true,
  zmanimWindows = [],
  schedulerHealthy = true,
  isAdmin = true,
  requireApproval = false,
  initial,
}: {
  audiences: AudienceOption[];
  fromEmail?: string;
  initialAudienceSlugs?: string[];
  attachmentsEnabled?: boolean;
  templates?: TemplateOption[];
  /** audience slug → default template id */
  audienceTemplates?: Record<string, string>;
  /** Custom fields offered as merge tokens, e.g. { token: "{{division}}", label: "Division" } */
  customTokens?: { token: string; label: string }[];
  canEmergency?: boolean;
  schoolTimezone: string;
  /** Upcoming Shabbosim / Yom Tov (empty unless Shabbos mode is on and times are loaded) */
  zmanimWindows?: ZmanimWindowOption[];
  /** False when the site URL or signing key is missing, so "I've read this" links can't be made */
  confirmLinksReady?: boolean;
  /** False when the background job that sends scheduled messages hasn't run recently */
  schedulerHealthy?: boolean;
  isAdmin?: boolean;
  /** Members' messages wait for an admin when this is on */
  requireApproval?: boolean;
  initial?: ComposeInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const init = initial?.input;
  const initialSelected = init ? audiences.filter((a) => init.audienceSlugs.includes(a.slug)) : initialAudienceSlugs ? audiences.filter((a) => initialAudienceSlugs.includes(a.slug)) : [];
  const [selectedAudiences, setSelectedAudiences] = useState<AudienceOption[]>(initialSelected);
  const defaultTemplateFor = (list: AudienceOption[]) => list.map((a) => audienceTemplates[a.slug]).find(Boolean) ?? null;
  const [templateId, setTemplateId] = useState<string | null>(init ? init.templateId : defaultTemplateFor(initialSelected));
  const [templateTouched, setTemplateTouched] = useState(!!init);

  const [channels, setChannels] = useState<Channel[]>(init?.channels?.length ? init.channels : ["email"]);
  const [channelMode, setChannelMode] = useState<"all" | "best">(init?.channelMode ?? "all");
  const [subject, setSubject] = useState(init?.subject ?? "");
  const [body, setBody] = useState(init?.body ?? "");
  const [greetingOn, setGreetingOn] = useState(!!init?.greeting);
  const [attachments, setAttachments] = useState<Attachment[]>(
    (init?.attachmentUrls ?? []).map((url) => ({ url, fileName: decodeURIComponent(url.split("/").pop() ?? "attachment"), contentType: "", size: 0 }))
  );
  const [isFundraising, setIsFundraising] = useState(init?.isFundraising ?? false);
  const [isEmergency, setIsEmergency] = useState(init?.isEmergency ?? false);
  const [familyPrefix, setFamilyPrefix] = useState(init?.familyPrefix ?? false);
  const [confirmButton, setConfirmButton] = useState(init?.confirmButton ?? false);
  const [studentsDirect, setStudentsDirect] = useState(init?.studentsDirect ?? false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set(init?.excludePersonIds ?? []));

  // When: now, or a school-local date and time (optionally repeating weekly)
  const [later, setLater] = useState(!!initial?.when || !!initial?.recurringId);
  const [today] = useState(() => localDateString(new Date(), schoolTimezone));
  const [date, setDate] = useState(initial?.when?.date ?? addDays(today, 1));
  const [time, setTime] = useState(initial?.when?.time ?? "09:00");
  const [repeatWeeks, setRepeatWeeks] = useState<number>(initial?.repeatWeeks ?? 0);
  // Shabbos / Yom Tov: owners may send anyway in a real emergency (reason is logged)
  // Around Shabbos: "3 hours before candle lighting", "30 minutes after Havdalah"
  const [zmanimMode, setZmanimMode] = useState(!!initial?.zmanim);
  const [zAnchor, setZAnchor] = useState<ZmanimAnchor>(initial?.zmanim?.anchor ?? "candle_lighting");
  const initialOffset = initial?.zmanim?.offsetMinutes ?? -180;
  const [zAmount, setZAmount] = useState(Math.abs(initialOffset) % 60 === 0 ? Math.abs(initialOffset) / 60 : Math.abs(initialOffset));
  const [zUnit, setZUnit] = useState<"hours" | "minutes">(Math.abs(initialOffset) % 60 === 0 ? "hours" : "minutes");
  const [zDirection, setZDirection] = useState<"before" | "after">(initialOffset > 0 ? "after" : "before");
  const [nowMs] = useState(() => Date.now());
  const firstUsable = zmanimWindows.find((w) => w.kind === "shabbos" && new Date(w.startsAt).getTime() > nowMs) ?? zmanimWindows[0];
  const [zWindow, setZWindow] = useState<string>(firstUsable?.startsAt ?? "");
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [windowNote, setWindowNote] = useState<{ key: string; note: string | null } | null>(null);
  const [previewTab, setPreviewTab] = useState<Channel>("email");
  const [showPreview, setShowPreview] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const whatsappBlocked = isFundraising || looksLikeFundraising(body, subject);
  const activeChannels = channels.filter((c) => !(c === "whatsapp" && whatsappBlocked));
  const greeting = greetingOn && activeChannels.includes("email") ? "Hi {{first_name}}," : null;

  const input = useMemo(
    () => ({
      audienceSlugs: selectedAudiences.map((a) => a.slug),
      audienceLabel: audienceSummary(selectedAudiences),
      channels,
      channelMode,
      subject,
      body,
      greeting,
      attachmentUrls: attachments.map((a) => a.url),
      templateId: channels.includes("sms") && channels.length === 1 ? null : templateId,
      isFundraising,
      isEmergency,
      familyPrefix,
      confirmButton,
      studentsDirect,
      excludePersonIds: [...excluded],
      onlyPersonIds: null as string[] | null,
    }),
    [selectedAudiences, channels, channelMode, subject, body, greeting, attachments, templateId, isFundraising, isEmergency, familyPrefix, confirmButton, studentsDirect, excluded]
  );

  const ready = selectedAudiences.length > 0 && channels.length > 0 && body.trim().length > 0;
  const { data: preview, loading: previewLoading, error: previewError } = usePreview(input, ready);

  function toggleAudience(a: AudienceOption) {
    const next = selectedAudiences.some((x) => x.slug === a.slug) ? selectedAudiences.filter((x) => x.slug !== a.slug) : [...selectedAudiences, a];
    setSelectedAudiences(next);
    setExcluded(new Set());
    if (!templateTouched) {
      const tid = defaultTemplateFor(next);
      setTemplateId(tid);
      const tpl = templates.find((t) => t.id === tid);
      if (tpl?.defaultSubject && !subject.trim()) setSubject(tpl.defaultSubject);
    }
  }

  function chooseTemplate(id: string) {
    setTemplateTouched(true);
    setTemplateId(id || null);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.defaultSubject && !subject.trim()) setSubject(tpl.defaultSubject);
  }

  function toggleChannel(c: Channel) {
    setChannels((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      if (next.length === 0) return prev; // always keep one
      if (c === "sms" && !prev.includes("sms")) setAttachments((a) => a); // attachments only apply to email/WhatsApp
      return next;
    });
    setPreviewTab(c);
  }

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function uploadAttachment(file: File, onProgress: (pct: number) => void) {
    const form = new FormData();
    form.append("file", file);
    form.append("channel", channels.includes("email") ? "email" : "whatsapp");
    const data = await postWithProgress<Attachment>("/api/upload", form, onProgress);
    setAttachments((prev) => [...prev, data]);
  }

  const total = preview?.messages ?? 0;
  const channelProblemFor = (c: Channel) => preview?.problems.find((p) => p.channel === c)?.problem ?? null;
  const subjectOk = !activeChannels.includes("email") || subject.trim().length > 0;
  const blockingProblem = preview?.problems && preview.problems.length > 0;

  const memberRequest = !isAdmin && requireApproval;
  const primaryAction: SubmitAction = memberRequest ? "request_approval" : later ? "schedule" : "send_now";
  const tzShort = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: schoolTimezone, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? schoolTimezone;
    } catch {
      return schoolTimezone;
    }
  }, [schoolTimezone]);
  const zOffset = (zUnit === "hours" ? zAmount * 60 : zAmount) * (zDirection === "before" ? -1 : 1);
  const zSelected = zmanimWindows.find((w) => w.startsAt === zWindow);
  const zAt = zSelected ? zmanimTime(zSelected, zAnchor, zOffset) : null;
  const zmanimActive = later && zmanimMode;
  const whenValid = !later
    ? true
    : zmanimActive
      ? !!zAt && zAmount >= 0 && Math.abs(zOffset) <= 72 * 60 && (repeatWeeks > 0 ? zSelected?.kind === "shabbos" : zAt.getTime() > nowMs + 60_000)
      : /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today && /^\d{2}:\d{2}$/.test(time);
  const scheduleLabel = zmanimActive && zAt ? formatInZone(zAt, schoolTimezone) : `${date} ${formatTimeOnly(time)} ${tzShort}`;

  const pausedNow = !!preview?.window.blocked && !later && primaryAction === "send_now";
  const overrideValid = pausedNow && !!preview?.canOverrideWindow && overrideOn && overrideReason.trim().length >= 5;
  const canSend = ready && subjectOk && !!preview && total > 0 && !blockingProblem && activeChannels.length > 0 && whenValid && (!pausedNow || overrideValid);

  const noteKey = later && !zmanimActive && whenValid ? `${date} ${time}` : "";
  useEffect(() => {
    if (!noteKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const [d, tm] = noteKey.split(" ");
      const res = await checkSendWindow(d, tm);
      if (!cancelled) setWindowNote({ key: noteKey, note: res.note });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [noteKey]);
  const shownNote = windowNote && windowNote.key === noteKey ? windowNote.note : null;

  function handleResult(result: SubmitResult) {
    if (!result.success) {
      setSendError(result.error);
      toast.error(result.error);
      return;
    }
    switch (result.kind) {
      case "sent":
        toast.success("Message sent");
        router.push(`/messages/${result.messageId}`);
        break;
      case "sending":
        toast.success(`Sending… ${result.remaining.toLocaleString()} still to go — it continues automatically`);
        router.push(`/messages/${result.messageId}`);
        break;
      case "scheduled":
        toast.success(`Scheduled for ${result.whenLabel}${result.note ? `. ${result.note}` : ""}`);
        router.push("/messages?tab=scheduled");
        break;
      case "recurring":
        toast.success(`${result.ruleLabel}. Next: ${result.whenLabel}`);
        router.push("/messages?tab=scheduled");
        break;
      case "draft":
        toast.success("Draft saved");
        router.push("/messages?tab=drafts");
        break;
      case "pending_approval":
        toast.success("Sent to an admin for approval");
        router.push("/messages?tab=approval");
        break;
    }
    router.refresh();
  }

  function run(act: SubmitAction) {
    setConfirmOpen(false);
    setSendError(null);
    startTransition(async () => {
      const result = await submitMessage(
        { ...input, channels: act === "draft" ? channels : activeChannels },
        {
          action: act,
          when: later && !zmanimActive && act !== "draft" && act !== "send_now" ? { date, time } : null,
          repeatWeeks: later && !zmanimActive && act === "schedule" && repeatWeeks > 0 ? repeatWeeks : null,
          zmanim:
            zmanimActive && (act === "schedule" || act === "request_approval")
              ? { anchor: zAnchor, offsetMinutes: zOffset, windowStartsAt: zWindow, repeatWeeks: act === "schedule" && repeatWeeks > 0 ? repeatWeeks : null }
              : null,
          override: act === "send_now" && overrideValid ? { reason: overrideReason.trim() } : null,
          messageId: initial?.messageId ?? null,
          recurringId: initial?.recurringId ?? null,
        }
      );
      handleResult(result);
    });
  }

  function handleConfirmedSend() {
    run(primaryAction);
  }

  const SMS_LIMIT = 160;
  const hasEmail = activeChannels.includes("email");
  const hasWhatsApp = activeChannels.includes("whatsapp");
  const showAttachments = attachmentsEnabled && (hasEmail || hasWhatsApp);
  const acceptTypes = hasEmail
    ? "image/jpeg,image/png,image/gif,image/webp,application/pdf,.docx,.xlsx"
    : "image/jpeg,image/png,image/gif,image/webp,application/pdf";
  const tokens = [...TEMPLATE_TOKENS.map((t) => ({ token: t.token as string, label: t.label as string })), ...customTokens];
  const tabChannel = activeChannels.includes(previewTab) ? previewTab : activeChannels[0];

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
        {/* ── TO ── */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="mt-2.5 w-16 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-3">To</span>
            <div className="flex-1">
              <AudienceDropdown allAudiences={audiences} selected={selectedAudiences} onToggle={toggleAudience} />
              {selectedAudiences.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {selectedAudiences.map((a) => (
                    <span key={a.slug} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pl-3 pr-2 text-xs font-medium text-ink-soft">
                      {a.label}
                      <span className="tabular-nums text-ink-3">{a.totalCount}</span>
                      <button type="button" onClick={() => toggleAudience(a)} className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-line hover:text-ink-soft" aria-label={`Remove ${a.label}`}>
                        <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[11px] text-ink-3">Students in an audience are reached through their parents — each parent gets one message, even with several kids.</p>
            </div>
          </div>
        </div>

        <div className="mx-6 border-t border-muted" />

        {/* ── CHANNELS ── */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="mt-2.5 w-16 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-3">Via</span>
            <div className="flex-1">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Channels">
                {(["email", "sms", "whatsapp"] as Channel[]).map((c) => {
                  const isOn = channels.includes(c);
                  const blocked = c === "whatsapp" && whatsappBlocked;
                  const count = preview?.perChannel[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={isOn && !blocked}
                      disabled={blocked}
                      title={blocked ? FUNDRAISING_WHATSAPP_NOTE : undefined}
                      onClick={() => toggleChannel(c)}
                      className={
                        "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
                        (isOn && !blocked ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink-soft hover:border-line-strong hover:text-ink")
                      }
                    >
                      <ChannelIcon channel={c} className="h-4 w-4" />
                      {channelLabel(c)}
                      {isOn && !blocked && count !== undefined && <span className="text-xs tabular-nums text-line-strong">{count.toLocaleString()}</span>}
                    </button>
                  );
                })}
              </div>

              {channels.length > 1 && (
                <div className="mt-3 inline-flex rounded-lg border border-line bg-canvas p-1 text-xs" role="radiogroup" aria-label="How to use the channels">
                  {([["all", "Every selected channel"], ["best", "Best channel for each parent"]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={channelMode === v}
                      onClick={() => setChannelMode(v)}
                      className={`rounded-md px-3 py-1.5 font-medium transition-colors ${channelMode === v ? "bg-card text-ink shadow-sm" : "text-ink-2 hover:text-ink"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {channels.length > 1 && (
                <p className="mt-1.5 text-[11px] text-ink-3">
                  {channelMode === "all"
                    ? "Each parent gets the message on every selected channel they have."
                    : "WhatsApp first; if it fails or they have no WhatsApp, text; if there's no phone, email. Each parent gets it once."}
                </p>
              )}
              {channels.map((c) => channelProblemFor(c) && (
                <p key={c} className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {channelProblemFor(c)}{" "}
                  <a href="/settings#channels" className="font-medium underline">Open Channels</a>
                </p>
              ))}

              <div className="mt-3 space-y-2">
                <Toggle
                  checked={isFundraising}
                  onChange={(v) => {
                    setIsFundraising(v);
                    if (v) setChannels((p) => (p.filter((c) => c !== "whatsapp").length ? p.filter((c) => c !== "whatsapp") : ["email"]));
                  }}
                  hint={isFundraising ? FUNDRAISING_WHATSAPP_NOTE : undefined}
                >
                  This is a fundraising message
                </Toggle>
                {channels.includes("whatsapp") && !isFundraising && whatsappBlocked && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    This reads like a fundraising message. WhatsApp doesn&apos;t allow those, so it won&apos;t go out on WhatsApp. Remove the donation wording to send it there.
                  </p>
                )}
              </div>

              <button type="button" onClick={() => setShowMore((v) => !v)} className="mt-3 text-xs font-medium text-ink-2 hover:text-ink">
                {showMore ? "Hide options" : "More options"}
              </button>
              {showMore && (
                <div className="mt-2 space-y-2.5 rounded-lg border border-line bg-canvas p-3">
                  <Toggle checked={familyPrefix} onChange={setFamilyPrefix} hint="e.g. “For Moshe (3rd) and Rivka (6th):” — helpful when a family has several children.">Start each message with the child&apos;s name</Toggle>
                  <Toggle checked={confirmButton && confirmLinksReady} onChange={setConfirmButton} disabled={!confirmLinksReady} hint={confirmLinksReady ? "Parents tap a link (no login) to tell you they've read it. Confirmed is the most reliable read signal." : "Needs NEXT_PUBLIC_SITE_URL and a signing key to be set on the server."}>Add an &ldquo;I&apos;ve read this&rdquo; button</Toggle>
                  <Toggle checked={studentsDirect} onChange={setStudentsDirect} hint="Otherwise students are reached through their parents.">Also message students directly (if they have a phone or email on file)</Toggle>
                  {canEmergency && (
                    <Toggle checked={isEmergency} onChange={setIsEmergency} hint="Reaches parents who chose “emergency messages only”. Doesn't override anyone who unsubscribed or replied STOP.">Emergency message</Toggle>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mx-6 border-t border-muted" />

        {/* ── COMPOSE ── */}
        <div className="px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="mt-1 w-16 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-3">Message</span>
            <div className="flex-1 space-y-3">
              {templates.length > 0 && !(activeChannels.length === 1 && activeChannels[0] === "sms") && (
                <div className="flex items-center gap-2 border-b border-muted pb-3">
                  <label htmlFor="compose-template" className="text-xs font-semibold uppercase tracking-wider text-ink-3">{hasEmail ? "Template" : "Sender label"}</label>
                  <select id="compose-template" value={templateId ?? ""} onChange={(e) => chooseTemplate(e.target.value)} className={SELECT_CLS}>
                    <option value="">School default</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {hasEmail && (
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line…"
                  dir="auto"
                  className="w-full border-0 border-b border-muted pb-3 text-sm font-semibold text-ink placeholder-line-strong outline-none transition-colors focus:border-line-strong"
                  autoFocus
                />
              )}
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={hasEmail ? "Write your message here…\n\nSeparate paragraphs with a blank line." : "Write your message…"}
                rows={hasEmail ? 12 : 6}
                dir="auto"
                className="w-full resize-none border-0 text-sm leading-relaxed text-ink placeholder-line-strong outline-none"
                autoFocus={!hasEmail}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-muted pt-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          insertToken(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className={`appearance-none cursor-pointer ${SELECT_CLS}`}
                    >
                      <option value="" disabled>Insert field…</option>
                      {tokens.map(({ token, label }) => <option key={token} value={token}>{label}</option>)}
                    </select>
                  </div>
                  {hasEmail && <Toggle checked={greetingOn} onChange={setGreetingOn}>Start with &ldquo;Hi {"{{first_name}}"},&rdquo;</Toggle>}
                </div>
                {activeChannels.includes("sms") && (
                  <span className={"text-xs tabular-nums " + (body.length > SMS_LIMIT ? "font-medium text-amber-600" : "text-ink-3")}>
                    {body.length > SMS_LIMIT ? `${body.length} chars · splits into ${Math.ceil(body.length / SMS_LIMIT)} texts` : `${body.length} / ${SMS_LIMIT}`}
                  </span>
                )}
              </div>

              {showAttachments && (
                <div className="border-t border-muted pt-3">
                  {attachments.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {attachments.map((a, i) => {
                        const sizeKb = Math.round(a.size / 1024);
                        const sizeLabel = sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
                        return (
                          <div key={a.url} className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
                            {IMAGE_RE.test(a.url) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.url} alt={a.fileName} className="h-6 w-6 rounded object-cover" />
                            ) : (
                              fileIcon(a.url)
                            )}
                            <div className="min-w-0">
                              <p className="max-w-[140px] truncate text-xs font-medium text-ink-soft">{a.fileName}</p>
                              {a.size > 0 && <p className="text-[10px] tabular-nums text-ink-3">{sizeLabel}</p>}
                            </div>
                            <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="ml-1 text-line-strong transition-colors hover:text-ink-2" aria-label="Remove attachment">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <GlassDropzone
                    key={hasEmail ? "email" : "wa"}
                    compact
                    accept={acceptTypes}
                    acceptLabel={hasEmail ? "a PDF, Word, Excel or image file" : "a PDF or image"}
                    isAccepted={(f) => acceptTypes.split(",").some((t) => f.type === t.trim() || f.name.toLowerCase().endsWith(t.trim()))}
                    maxBytes={10 * 1024 * 1024}
                    title="Attach a file — drop it here or browse"
                    hint={hasEmail ? "PDF, Word, Excel, or image · 10 MB max" : "PDF or image · 10 MB max"}
                    onUpload={uploadAttachment}
                    resetAfterSuccess={1400}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mx-6 border-t border-muted" />

        {/* ── PREVIEW ── */}
        <div className="px-6 py-4">
          <button type="button" onClick={() => setShowPreview((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-2 transition-colors hover:text-ink-hover">
            <svg className={"h-3.5 w-3.5 transition-transform " + (showPreview ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
            Message Preview
          </button>
          {showPreview && (
            <div className="mt-4 space-y-3">
              {activeChannels.length > 1 && (
                <div className="flex gap-1">
                  {activeChannels.map((c) => (
                    <button key={c} type="button" onClick={() => setPreviewTab(c)} className={`rounded-md px-2.5 py-1 text-xs font-medium ${tabChannel === c ? "bg-muted text-ink" : "text-ink-3 hover:text-ink-2"}`}>{channelLabel(c)}</button>
                  ))}
                </div>
              )}
              {tabChannel === "email" && <EmailPreview subject={subject} body={body} attachments={attachments} greetingTemplate={greeting} />}
              {tabChannel === "sms" && <SmsPreview body={body} />}
              {tabChannel === "whatsapp" && <WhatsAppPreview body={body} attachments={attachments} />}
            </div>
          )}
        </div>

        {/* ── Personalization (real recipients) ── */}
        {preview && preview.samples.length > 0 && (
          <details className="border-t border-muted px-6 py-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-2">
              Preview personalization <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-ink-2">{preview.samples.length} of {preview.messages.toLocaleString()}</span>
            </summary>
            <div className="mt-3 divide-y divide-muted overflow-hidden rounded-lg border border-line">
              {preview.samples.map((p, i) => (
                <div key={i} className="bg-card px-4 py-3">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-xs font-semibold text-ink">{p.name} <span className="font-normal text-ink-3">· {channelLabel(p.channel)}</span></span>
                    <span className="truncate text-[10px] text-ink-3">{p.address}</span>
                  </div>
                  {p.subject && <p className="text-xs font-semibold text-ink-soft">{p.subject}</p>}
                  <p dir="auto" className="whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">{p.text}</p>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── EDITING BANNER ── */}
        {initial && (initial.status === "rejected" || initial.status === "pending_approval" || initial.status === "scheduled" || initial.recurringId) && (
          <div className={"border-t border-muted px-6 py-3 text-xs " + (initial.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>
            {initial.status === "rejected" && <>An admin sent this back{initial.rejectionReason ? <>: <span className="font-medium">&ldquo;{initial.rejectionReason}&rdquo;</span></> : "."} Edit it and send it for approval again.</>}
            {initial.status === "pending_approval" && (isAdmin ? "Waiting for your approval. Send it as is, change it first, or schedule it." : "Waiting for an admin to approve it. Saving changes keeps it in the queue.")}
            {initial.status === "scheduled" && "This message is scheduled. Saving changes updates it; nothing has been sent."}
            {initial.recurringId && "Editing a repeating send. Changes apply to future sends, not ones already scheduled."}
          </div>
        )}

        {/* ── WHEN ── */}
        <div className="border-t border-muted px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="mt-1.5 w-16 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-3">When</span>
            <div className="flex-1 space-y-3">
              <div className="inline-flex flex-wrap rounded-lg border border-line p-0.5" role="group" aria-label="When to send">
                {([
                  ["now", memberRequest ? "As soon as approved" : "Send now"],
                  ["clock", "Schedule for later"],
                  ...(zmanimWindows.length > 0 ? ([["zmanim", "Around Shabbos"]] as const) : []),
                ] as const).map(([mode, label]) => {
                  const active = mode === "now" ? !later : mode === "zmanim" ? zmanimActive : later && !zmanimMode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      disabled={!!initial?.recurringId && mode === "now"}
                      onClick={() => {
                        setLater(mode !== "now");
                        setZmanimMode(mode === "zmanim");
                        if (mode === "now") setRepeatWeeks(0);
                      }}
                      className={"rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 " + (active ? "bg-ink text-on-ink" : "text-ink-2 hover:text-ink")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {zmanimActive && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                    <input type="number" min={0} max={72 * (zUnit === "hours" ? 1 : 60)} value={zAmount} onChange={(e) => setZAmount(Math.max(0, Number(e.target.value) || 0))} aria-label="Amount" className={`${SELECT_CLS} !w-16`} />
                    <select value={zUnit} onChange={(e) => setZUnit(e.target.value as "hours" | "minutes")} aria-label="Unit" className={SELECT_CLS}>
                      <option value="hours">hours</option>
                      <option value="minutes">minutes</option>
                    </select>
                    <select value={zDirection} onChange={(e) => setZDirection(e.target.value as "before" | "after")} aria-label="Before or after" className={SELECT_CLS}>
                      <option value="before">before</option>
                      <option value="after">after</option>
                    </select>
                    <select value={zAnchor} onChange={(e) => setZAnchor(e.target.value as ZmanimAnchor)} aria-label="Anchor" className={SELECT_CLS}>
                      <option value="candle_lighting">candle lighting</option>
                      <option value="havdalah">Havdalah (Motzei Shabbos)</option>
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                    <label htmlFor="compose-zwindow">For</label>
                    <select id="compose-zwindow" value={zWindow} onChange={(e) => setZWindow(e.target.value)} className={SELECT_CLS}>
                      {zmanimWindows.map((w) => (
                        <option key={w.startsAt} value={w.startsAt} disabled={repeatWeeks > 0 && w.kind !== "shabbos"}>
                          {(w.label ?? (w.kind === "yomtov" ? "Yom Tov" : "Shabbos"))} · candles {formatInZone(w.startsAt, schoolTimezone, { withZone: false })}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="compose-zrepeat" className="text-xs text-ink-2">Repeat</label>
                      <select id="compose-zrepeat" value={repeatWeeks} onChange={(e) => setRepeatWeeks(Number(e.target.value))} className={SELECT_CLS}>
                        {!initial?.recurringId && <option value={0}>Just this once</option>}
                        <option value={1}>Every Shabbos</option>
                        {[2, 3, 4].map((n) => <option key={n} value={n}>Every {n} weeks</option>)}
                      </select>
                    </div>
                  )}
                  <p className="rounded-md bg-muted px-3 py-2 text-[12px] text-ink-2">
                    {zAt ? (
                      <>
                        {describeOffset(zAnchor, zOffset)}: <span className="font-medium text-ink">{formatInZone(zAt, schoolTimezone)}</span>
                        {repeatWeeks > 0 && <span className="text-ink-3"> · then {repeatWeeks === 1 ? "every Shabbos" : `every ${repeatWeeks} weeks`}; weeks with Yom Tov are skipped</span>}
                        {zAt.getTime() <= nowMs + 60_000 && repeatWeeks === 0 && <span className="block text-amber-700">That time has already passed. Choose a later Shabbos.</span>}
                      </>
                    ) : (
                      "Choose a Shabbos."
                    )}
                  </p>
                  <p className="text-[11px] text-ink-3">The time follows the seasons by itself. Who gets it is worked out when it sends.</p>
                  {!schedulerHealthy && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Scheduled messages aren&apos;t being picked up right now: the background sender hasn&apos;t checked in. {isAdmin ? "See Settings → Messaging for the one-time setup." : "Ask an admin to check Settings → Messaging."}
                    </p>
                  )}
                </div>
              )}
              {later && !zmanimMode && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={SELECT_CLS} />
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" className={SELECT_CLS} />
                    <span className="text-xs text-ink-3">{tzShort} (your school&apos;s time zone)</span>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="compose-repeat" className="text-xs text-ink-2">Repeat</label>
                      <select id="compose-repeat" value={repeatWeeks} onChange={(e) => setRepeatWeeks(Number(e.target.value))} className={SELECT_CLS}>
                        {!initial?.recurringId && <option value={0}>Doesn&apos;t repeat</option>}
                        <option value={1}>Every week</option>
                        {[2, 3, 4, 6].map((n) => <option key={n} value={n}>Every {n} weeks</option>)}
                      </select>
                      {repeatWeeks > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && (
                        <span className="text-xs text-ink-3">on {WEEKDAY_NAMES[weekdayOf(date)]}s at {formatTimeOnly(time)}</span>
                      )}
                    </div>
                  )}
                  {shownNote && <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{shownNote}</p>}
                  <p className="text-[11px] text-ink-3">Who gets it is worked out when it sends, so families who join or leave before then are accounted for.</p>
                  {!schedulerHealthy && (
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                      Scheduled messages aren&apos;t being picked up right now: the background sender hasn&apos;t checked in. {isAdmin ? "See Settings → Messaging for the one-time setup." : "Ask an admin to check Settings → Messaging."}
                    </p>
                  )}
                </div>
              )}
              {memberRequest && <p className="text-[11px] text-ink-3">An admin approves messages from members before they go out.</p>}
            </div>
          </div>
        </div>

        {/* ── SEND ── */}
        <div className="rounded-b-xl border-t border-muted bg-canvas px-6 py-5">
          {sendError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{sendError}</div>}
          {previewError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{previewError}</div>}
          {pausedNow && preview && preview.window.blocked && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-medium">Sending is paused</p>
              <p className="mt-0.5 text-[13px] leading-relaxed">{preview.window.message}</p>
              <p className="mt-1 text-[12px] text-amber-800">You can still save a draft or choose Schedule for later.</p>
              {preview.canOverrideWindow && (
                <div className="mt-3 border-t border-amber-200 pt-3">
                  <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                    <input type="checkbox" checked={overrideOn} onChange={(e) => setOverrideOn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--ink)]" />
                    <span>
                      <span className="font-medium">This is an emergency. Send anyway.</span>
                      <span className="block text-[12px] text-amber-800">Only the school owner can do this. Your name, the time and your reason are recorded.</span>
                    </span>
                  </label>
                  {overrideOn && (
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Reason, e.g. building evacuated"
                      maxLength={200}
                      className="mt-2 w-full rounded-md border border-amber-300 bg-card px-3 py-2 text-sm text-ink outline-none focus:border-amber-500"
                    />
                  )}
                </div>
              )}
            </div>
          )}
          {preview?.notes.map((n) => <p key={n} className="mb-2 text-xs text-ink-2">{n}</p>)}

          {preview && preview.unreachableCount > 0 && (
            <div className="mb-3 text-xs text-ink-2">
              <button type="button" onClick={() => setShowSkipped((v) => !v)} className="underline decoration-dotted underline-offset-2">
                {preview.unreachableCount.toLocaleString()} {preview.unreachableCount === 1 ? "person" : "people"} won&apos;t get this
              </button>
              {Object.entries({ opted_out: "opted out", no_address: "no contact info", preference: "turned it off", emergency_only: "emergency messages only" }).map(([k, label]) =>
                preview.excluded[k as keyof typeof preview.excluded] > 0 ? <span key={k} className="text-ink-3"> · {preview.excluded[k as keyof typeof preview.excluded]} {label}</span> : null
              )}
              {preview.studentsWithoutParent > 0 && <span className="text-amber-700"> · {preview.studentsWithoutParent} student{preview.studentsWithoutParent === 1 ? " has" : "s have"} no parent linked</span>}
              {showSkipped && (
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-line bg-card px-3 py-2">
                  {preview.unreachable.map((u, i) => <li key={i}><span className="font-medium text-ink">{u.name}</span> <span className="text-ink-3">— {u.reason}</span></li>)}
                  {preview.unreachableCount > preview.unreachable.length && <li className="text-ink-3">…and {preview.unreachableCount - preview.unreachable.length} more</li>}
                </ul>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              {selectedAudiences.length === 0 ? (
                "Choose an audience to continue."
              ) : !body.trim() ? (
                "Write your message to see who it reaches."
              ) : previewLoading && !preview ? (
                "Working out who this reaches…"
              ) : preview ? (
                preview.messages === 0 ? (
                  "Nobody can be reached with these settings."
                ) : (
                  <span className={previewLoading ? "opacity-60" : ""}>
                    <span className="font-medium text-ink-soft">{preview.people.toLocaleString()} {preview.people === 1 ? "person" : "people"}</span> will get this
                    {" — "}
                    {(["email", "whatsapp", "sms"] as Channel[]).filter((c) => preview.perChannel[c] > 0).map((c) => `${preview.perChannel[c].toLocaleString()} ${c === "sms" ? "text" : channelLabel(c)}`).join(" · ")}
                  </span>
                )
              ) : null}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => run("draft")}
                disabled={isPending || (selectedAudiences.length === 0 && !body.trim() && !subject.trim())}
                className="inline-flex items-center rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save draft
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend || isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-on-ink transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? "Working…" : memberRequest ? "Review & request approval" : later ? "Review & schedule" : "Review & send"}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONFIRM ── */}
      {confirmOpen && preview && (
        <div className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-send-title" className="animate-pop-in w-full max-w-md rounded-xl border border-line bg-card shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-muted px-5 py-4">
              <h2 id="confirm-send-title" className="text-sm font-semibold text-ink">
                {memberRequest ? "Ask an admin to send to" : later ? `Schedule for ${scheduleLabel} to` : "Send to"} {preview.people.toLocaleString()} {preview.people === 1 ? "person" : "people"}?
              </h2>
              <p className="mt-0.5 text-xs text-ink-2">
                {preview.messages.toLocaleString()} message{preview.messages === 1 ? "" : "s"}: {(["email", "whatsapp", "sms"] as Channel[]).filter((c) => preview.perChannel[c] > 0).map((c) => `${preview.perChannel[c].toLocaleString()} ${c === "sms" ? "text" : channelLabel(c)}`).join(" · ")}. {later ? "This is who it reaches today; the list is checked again when it sends." : "Remove anyone who shouldn&apos;t get it."}
              </p>
            </div>
            <div className="max-h-72 divide-y divide-canvas overflow-y-auto">
              {preview.people_list.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-3">No recipients remaining.</p>
              ) : (
                preview.people_list.map((r) => (
                  <div key={r.id} className="group flex items-center justify-between px-5 py-2.5 hover:bg-canvas">
                    <div className="mr-3 min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-hover">{r.name}</span>
                      {r.childrenLabel && <span className="block truncate text-[11px] text-ink-3">For {r.childrenLabel}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="flex gap-1">{r.channels.map((c) => <span key={c.channel + c.address} title={c.address} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-2">{c.channel === "sms" ? "Text" : channelLabel(c.channel)}</span>)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${r.name}`}
                        onClick={() => setExcluded((prev) => new Set([...prev, r.id]))}
                        className="flex h-5 w-5 items-center justify-center rounded text-line-strong opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-muted px-5 py-4">
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-canvas">Cancel</button>
                <button type="button" onClick={handleConfirmedSend} disabled={preview.people_list.length === 0 || previewLoading} className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-on-ink transition-colors hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-40">
                  {memberRequest ? "Send for approval" : later ? (repeatWeeks > 0 ? "Confirm & repeat" : "Confirm & schedule") : "Confirm & send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
