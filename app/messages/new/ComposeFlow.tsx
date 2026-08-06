"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, previewRecipients, resolveAllRecipients, type Channel, type RecipientPreview, type ResolvedRecipient } from "../actions";
import { TEMPLATE_TOKENS, renderTemplate } from "@/lib/template";

export type AudienceOption = {
  slug: string;
  label: string;
  totalCount: number;
  emailCount: number;
  phoneCount: number;
};

type Attachment = {
  url: string;
  fileName: string;
  contentType: string;
  size: number;
};

const PREVIEW_PERSON = {
  first_name: "Sarah",
  last_name: "Cohen",
  preferred_name: "Sarah",
  salutation: "Mrs.",
  email: "sarah.cohen@example.com",
  graduation_year: new Date().getFullYear() + 4, // ~Grade 8
};

function recipientCount(audiences: AudienceOption[], channel: Channel): number {
  if (channel === "email") return audiences.reduce((s, a) => s + a.emailCount, 0);
  return audiences.reduce((s, a) => s + a.phoneCount, 0);
}

function channelLabel(channel: Channel): string {
  return channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp";
}

function channelField(channel: Channel): string {
  return channel === "email" ? "email address" : "phone number";
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
      <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
      >
        <span
          className={
            "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors " +
            (checked
              ? "border-zinc-900 bg-zinc-900"
              : "border-zinc-300 bg-white")
          }
        >
          {checked && (
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </span>
        <span className="flex-1 text-sm font-medium text-zinc-900">{a.label}</span>
        <span className="text-xs tabular-nums text-zinc-400">{a.totalCount.toLocaleString()}</span>
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
            ? "border-zinc-400 bg-white text-zinc-900"
            : selected.length > 0
            ? "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400"
            : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600")
        }
      >
        <span className={selected.length > 0 ? "font-medium" : ""}>{triggerLabel}</span>
        <svg
          className={"h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform " + (open ? "rotate-180" : "")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {/* Search */}
          <div className="sticky top-0 border-b border-zinc-100 bg-white px-3 py-2">
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audiences…"
                className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-300 focus:bg-white"
              />
            </div>
          </div>

          <div className="p-2">
            {system.length > 0 && (
              <div>
                <p className="mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Audiences
                </p>
                {system.map((a) => <AudienceRow key={a.slug} a={a} />)}
              </div>
            )}
            {custom.length > 0 && (
              <div className={system.length > 0 ? "mt-2 border-t border-zinc-100 pt-2" : ""}>
                <p className="mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Groups
                </p>
                {custom.map((a) => <AudienceRow key={a.slug} a={a} />)}
              </div>
            )}
            {system.length === 0 && custom.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-zinc-400">No audiences found</p>
            )}
          </div>

          {selected.length > 0 && (
            <div className="sticky bottom-0 border-t border-zinc-100 bg-zinc-50 px-3 py-2.5">
              <button
                type="button"
                onClick={() => { setOpen(false); setSearch(""); }}
                className="w-full rounded-md bg-zinc-900 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
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
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        Preview — as Sarah Cohen will see it
      </p>
      <div className="mx-auto max-w-[560px] rounded-xl border border-zinc-200 bg-white px-8 py-6 shadow-sm">
        {subject && (
          <p className="mb-4 border-b border-zinc-100 pb-4 text-sm font-semibold text-zinc-900">
            {renderTemplate(subject, PREVIEW_PERSON)}
          </p>
        )}
        {previewGreeting && (
          <p className="mb-4 text-sm font-semibold text-zinc-900">{previewGreeting}</p>
        )}
        {paragraphs.length > 0 ? (
          paragraphs.map((para, i) => (
            <p key={i} className="mb-4 text-sm leading-relaxed text-zinc-800 last:mb-0">
              {para.split("\n").map((line, j, arr) => (
                <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
              ))}
            </p>
          ))
        ) : (
          <p className="text-sm italic text-zinc-300">Your message will appear here…</p>
        )}
        {images.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
            {images.map((a) => (
              <img key={a.url} src={a.url} alt={a.fileName} className="max-w-full rounded-md" />
            ))}
          </div>
        )}
        {docs.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {docs.map((a) => (
              <div key={a.url} className="flex items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                {fileIcon(a.url)}
                <span className="text-xs text-zinc-600">{a.fileName}</span>
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
    <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-6">
      <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        Preview — as Sarah Cohen will see it
      </p>
      <div className="mx-auto max-w-[280px]">
        {rendered ? (
          <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-zinc-300 px-4 py-2.5 text-sm leading-relaxed text-zinc-900">
            {rendered}
          </div>
        ) : (
          <p className="text-xs italic text-zinc-400">Your message will appear here…</p>
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
    <div className="rounded-xl border border-zinc-200 bg-[#e5ddd5] p-6">
      <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Preview — as Sarah Cohen will see it
      </p>
      <div className="mx-auto max-w-[280px]">
        <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-zinc-900 shadow-sm">
          {firstImage && (
            <img src={firstImage.url} alt={firstImage.fileName} className="mb-2 max-w-full rounded-lg" />
          )}
          {docs.length > 0 && (
            <div className="mb-2 space-y-1">
              {docs.map((a) => (
                <div key={a.url} className="flex items-center gap-1.5 rounded bg-zinc-50 px-2 py-1.5 text-xs text-zinc-600">
                  {fileIcon(a.url)}
                  {a.fileName}
                </div>
              ))}
            </div>
          )}
          {rendered || <span className="italic text-zinc-400">Your message will appear here…</span>}
          <span className="ml-2 text-[10px] text-zinc-400">✓✓</span>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function ComposeFlow({
  audiences,
  fromEmail,
  initialAudienceSlugs,
  attachmentsEnabled = false,
}: {
  audiences: AudienceOption[];
  fromEmail: string;
  initialAudienceSlugs?: string[];
  attachmentsEnabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialSelected = initialAudienceSlugs
    ? audiences.filter((a) => initialAudienceSlugs.includes(a.slug))
    : [];

  const [selectedAudiences, setSelectedAudiences] = useState<AudienceOption[]>(initialSelected);
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [greetingTemplate, setGreetingTemplate] = useState("Hi {{first_name}},");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const [recipientPreviews, setRecipientPreviews] = useState<RecipientPreview[] | null>(null);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [showRecipientPreviews, setShowRecipientPreviews] = useState(false);
  const [isLoadingPreviews, startPreviewTransition] = useTransition();

  // Confirmation step — populated when user clicks "Send Email"
  const [confirmRecipients, setConfirmRecipients] = useState<ResolvedRecipient[] | null>(null);
  const [removedPersonIds, setRemovedPersonIds] = useState<Set<string>>(new Set());
  const [isResolvingRecipients, startResolveTransition] = useTransition();

  function toggleAudience(a: AudienceOption) {
    setRecipientPreviews(null);
    setSelectedAudiences((prev) =>
      prev.some((x) => x.slug === a.slug)
        ? prev.filter((x) => x.slug !== a.slug)
        : [...prev, a]
    );
  }

  function handleChannelChange(c: Channel) {
    setChannel(c);
    if (c !== "email") setSubject("");
    if (c === "sms") setAttachments([]);
    setUploadError(null);
    setRecipientPreviews(null);
    setRecipientTotal(0);
    setShowRecipientPreviews(false);
  }

  function handleToggleRecipientPreviews() {
    if (showRecipientPreviews) {
      setShowRecipientPreviews(false);
      return;
    }
    setShowRecipientPreviews(true);
    if (recipientPreviews === null) {
      startPreviewTransition(async () => {
        const result = await previewRecipients(
          selectedAudiences.map((a) => a.slug),
          channel,
          body,
          8
        );
        setRecipientPreviews(result.previews);
        setRecipientTotal(result.totalCount);
      });
    }
  }

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const newBody = body.slice(0, start) + token + body.slice(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploadError(null);
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("channel", channel);

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUploadError("The file could not be uploaded. Please try a different file or try again.");
        return;
      }
      setAttachments((prev) => [...prev, data as Attachment]);
    } catch {
      setUploadError("The file could not be uploaded. Please check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  const totalCount = selectedAudiences.reduce((s, a) => s + a.totalCount, 0);
  const emailCount = selectedAudiences.reduce((s, a) => s + a.emailCount, 0);
  const phoneCount = selectedAudiences.reduce((s, a) => s + a.phoneCount, 0);
  const eligible = recipientCount(selectedAudiences, channel);
  const missing = totalCount - eligible;

  const canSend =
    selectedAudiences.length > 0 &&
    body.trim().length > 0 &&
    (channel !== "email" || subject.trim().length > 0) &&
    eligible > 0;

  // Step 1: user clicks "Send Email" → resolve recipients → show confirmation
  function handleSend() {
    if (!canSend) return;
    setSendError(null);
    setRemovedPersonIds(new Set());
    startResolveTransition(async () => {
      const resolved = await resolveAllRecipients(
        selectedAudiences.map((a) => a.slug),
        channel
      );
      setConfirmRecipients(resolved);
    });
  }

  // Step 2: user reviews recipient list and confirms → actually send
  function handleConfirmedSend() {
    if (!canSend || !confirmRecipients) return;
    setConfirmRecipients(null);
    setSendError(null);
    startTransition(async () => {
      const label = audienceSummary(selectedAudiences);
      const result = await sendMessage(
        selectedAudiences.map((a) => a.slug),
        label,
        channel,
        subject,
        body,
        attachments.map((a) => a.url),
        channel === "email" && greetingEnabled ? greetingTemplate : null,
        removedPersonIds.size > 0 ? Array.from(removedPersonIds) : undefined
      );
      if (result.success) {
        router.push("/messages");
        router.refresh();
      } else {
        setSendError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  const SMS_LIMIT = 160;
  const channelSupportsAttachments = channel !== "sms";
  const showAttachments = attachmentsEnabled && channelSupportsAttachments;
  const acceptTypes =
    channel === "whatsapp"
      ? "image/jpeg,image/png,image/gif,image/webp,application/pdf"
      : "image/jpeg,image/png,image/gif,image/webp,application/pdf,.docx,.xlsx";

  return (
    <>
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">

      {/* ── TO ────────────────────────────────────────────────────────────── */}
      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="mt-2.5 w-16 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">To</span>
          <div className="flex-1">
            <AudienceDropdown
              allAudiences={audiences}
              selected={selectedAudiences}
              onToggle={toggleAudience}
            />

            {/* Selected audience chips */}
            {selectedAudiences.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {selectedAudiences.map((a) => (
                  <span key={a.slug} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1 pl-3 pr-2 text-xs font-medium text-zinc-700">
                    {a.label}
                    <span className="tabular-nums text-zinc-400">{a.totalCount}</span>
                    <button
                      type="button"
                      onClick={() => toggleAudience(a)}
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600"
                      aria-label={`Remove ${a.label}`}
                    >
                      <svg className="h-2 w-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-6 border-t border-zinc-100" />

      {/* ── CHANNEL ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="mt-2.5 w-16 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Via</span>
          <div className="flex-1">
            <div className="flex gap-2">
              {(["email", "sms", "whatsapp"] as Channel[]).map((c) => {
                const count = c === "email" ? emailCount : phoneCount;
                const isSelected = channel === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleChannelChange(c)}
                    className={
                      "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors " +
                      (isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900")
                    }
                  >
                    <ChannelIcon channel={c} className="h-4 w-4" />
                    {channelLabel(c)}
                    {selectedAudiences.length > 0 && (
                      <span className={
                        "text-xs tabular-nums " +
                        (isSelected ? "text-zinc-300" : "text-zinc-400")
                      }>
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Human-language channel notes */}
            {channel === "sms" && (
              <p className="mt-3 text-xs text-zinc-400">
                Messages are sent as text. Keep messages under {SMS_LIMIT} characters to avoid splitting.
              </p>
            )}
            {channel === "whatsapp" && (
              <p className="mt-3 text-xs text-zinc-400">
                Messages are sent via WhatsApp. Recipients must have WhatsApp installed on their phone.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-6 border-t border-zinc-100" />

      {/* ── COMPOSE ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-5">
        <div className="flex items-start gap-4">
          <span className="mt-1 w-16 flex-shrink-0 text-xs font-semibold uppercase tracking-wider text-zinc-400">Message</span>
          <div className="flex-1 space-y-3">
            {channel === "email" && (
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line…"
                className="w-full border-0 border-b border-zinc-100 pb-3 text-sm font-semibold text-zinc-900 placeholder-zinc-300 outline-none transition-colors focus:border-zinc-300"
                autoFocus
              />
            )}

            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => { setBody(e.target.value); setRecipientPreviews(null); }}
              placeholder={
                channel === "email"
                  ? "Write your message here…\n\nSeparate paragraphs with a blank line."
                  : channel === "sms"
                  ? "Write your text message…"
                  : "Write your WhatsApp message…"
              }
              rows={channel === "email" ? 12 : 6}
              className="w-full resize-none border-0 text-sm leading-relaxed text-zinc-900 placeholder-zinc-300 outline-none"
              autoFocus={channel !== "email"}
            />

            {/* Toolbar: personalization tokens + greeting toggle + char count */}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5">
              <div className="flex flex-wrap items-center gap-3">
                {/* Insert token dropdown */}
                <div className="relative">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        insertToken(e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="appearance-none cursor-pointer rounded-md border border-zinc-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-zinc-600 outline-none transition-colors hover:border-zinc-300 hover:text-zinc-900 focus:border-zinc-300"
                  >
                    <option value="" disabled>Insert field…</option>
                    {TEMPLATE_TOKENS.map(({ token, label }) => (
                      <option key={token} value={token}>{label}</option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>

              </div>

              {/* SMS character count */}
              {channel === "sms" && (
                <span className={"text-xs tabular-nums " + (body.length > SMS_LIMIT ? "font-medium text-amber-600" : "text-zinc-400")}>
                  {body.length > SMS_LIMIT
                    ? `${body.length} chars · splits into ${Math.ceil(body.length / SMS_LIMIT)} messages`
                    : `${body.length} / ${SMS_LIMIT}`}
                </span>
              )}
            </div>

            {/* Attachment zone — only shown when storage is configured */}
            {showAttachments && (
              <div className="border-t border-zinc-100 pt-3">
                {attachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {attachments.map((a, i) => {
                      const sizeKb = Math.round(a.size / 1024);
                      const sizeLabel = sizeKb >= 1024
                        ? `${(sizeKb / 1024).toFixed(1)} MB`
                        : `${sizeKb} KB`;
                      return (
                        <div
                          key={a.url}
                          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                        >
                          {IMAGE_RE.test(a.url) ? (
                            <img src={a.url} alt={a.fileName} className="h-6 w-6 rounded object-cover" />
                          ) : (
                            fileIcon(a.url)
                          )}
                          <div className="min-w-0">
                            <p className="max-w-[140px] truncate text-xs font-medium text-zinc-700">
                              {a.fileName}
                            </p>
                            <p className="text-[10px] tabular-nums text-zinc-400">{sizeLabel}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                            className="ml-1 text-zinc-300 transition-colors hover:text-zinc-500"
                            aria-label="Remove attachment"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setUploadError(null); fileInputRef.current?.click(); }}
                    disabled={isUploading}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUploading ? (
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                      </svg>
                    )}
                    {isUploading ? "Uploading…" : "Attach files"}
                  </button>
                  <span className="text-xs text-zinc-400">
                    {channel === "email"
                      ? "PDF, Word, Excel, or image · 10 MB max"
                      : "PDF or image · 10 MB max"}
                  </span>
                </div>

                {uploadError && (
                  <p className="mt-2 text-xs text-red-600">{uploadError}</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptTypes}
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-6 border-t border-zinc-100" />

      {/* ── PREVIEW ───────────────────────────────────────────────────────── */}
      <div className="px-6 py-4">
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-800"
        >
          <svg
            className={"h-3.5 w-3.5 transition-transform " + (showPreview ? "rotate-180" : "")}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
          Message Preview
        </button>
        {showPreview && (
          <div className="mt-4">
            {channel === "email" && <EmailPreview subject={subject} body={body} attachments={attachments} greetingTemplate={greetingEnabled ? greetingTemplate : null} />}
            {channel === "sms" && <SmsPreview body={body} />}
            {channel === "whatsapp" && <WhatsAppPreview body={body} attachments={attachments} />}
          </div>
        )}
      </div>

      {/* ── RECIPIENT PREVIEWS ────────────────────────────────────────────── */}
      {selectedAudiences.length > 0 && body.trim() && (
        <div className="border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={handleToggleRecipientPreviews}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-800"
          >
            <svg
              className={"h-3.5 w-3.5 transition-transform " + (showRecipientPreviews ? "rotate-180" : "")}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
            Preview personalization
            {recipientTotal > 0 && (
              <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-zinc-500">
                {Math.min(8, recipientTotal)} of {recipientTotal} recipients
              </span>
            )}
          </button>

          {showRecipientPreviews && (
            <div className="mt-3">
              {isLoadingPreviews ? (
                <div className="flex items-center gap-2 py-4 text-xs text-zinc-400">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Personalizing messages…
                </div>
              ) : recipientPreviews && recipientPreviews.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-zinc-200 divide-y divide-zinc-100">
                  {recipientPreviews.map((p, i) => (
                    <div key={i} className="bg-white px-4 py-3 transition-colors hover:bg-zinc-50">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-xs font-semibold text-zinc-900">{p.name}</span>
                        <span className="text-[10px] text-zinc-400">{p.contactValue}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-600 whitespace-pre-wrap">{p.rendered}</p>
                    </div>
                  ))}
                  {recipientTotal > 8 && (
                    <div className="bg-zinc-50 px-4 py-2.5 text-xs text-zinc-400">
                      + {(recipientTotal - 8).toLocaleString()} more recipients
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-2 text-xs text-zinc-400">
                  No contacts with a {channelField(channel)} found in the selected audiences.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SEND ──────────────────────────────────────────────────────────── */}
      <div className="rounded-b-xl border-t border-zinc-100 bg-zinc-50 px-6 py-5">
        {sendError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {sendError}
          </div>
        )}

        {eligible === 0 && selectedAudiences.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
            None of the selected contacts have a {channelField(channel)}. Try switching to a different channel.
          </div>
        )}

        {missing > 0 && eligible > 0 && (
          <p className="mb-3 text-xs text-zinc-400">
            {missing.toLocaleString()} contact{missing !== 1 ? "s" : ""}{" "}
            {missing === 1 ? "doesn't" : "don't"} have a {channelField(channel)} and won't receive this message.
          </p>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            {selectedAudiences.length === 0
              ? "Choose an audience to continue."
              : eligible === 0
              ? "No eligible contacts for this channel."
              : (
                <>
                  <span className="font-medium text-zinc-700">{eligible.toLocaleString()} contacts</span>
                  {" "}will receive this {channelLabel(channel).toLowerCase()}.
                </>
              )}
          </p>

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend || isPending || isResolvingRecipients}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {(isPending || isResolvingRecipients) ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {isPending ? "Sending…" : "Resolving…"}
              </>
            ) : (
              <>
                Send {channelLabel(channel)}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>

    {/* ── PRE-SEND CONFIRMATION MODAL ─────────────────────────────────────── */}
    {confirmRecipients && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmRecipients(null)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-send-title"
          className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 id="confirm-send-title" className="text-sm font-semibold text-zinc-900">
              Confirm send to {confirmRecipients.length.toLocaleString()} {confirmRecipients.length === 1 ? "recipient" : "recipients"}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Review the list and remove anyone who should not receive this message.
            </p>
          </div>

          {/* Recipient list — scrollable, shows every address */}
          <div className="max-h-72 overflow-y-auto divide-y divide-zinc-50">
            {confirmRecipients.length === 0 ? (
              <p className="px-5 py-4 text-sm text-zinc-400">No recipients remaining.</p>
            ) : (
              confirmRecipients.map((r) => (
                <div key={r.personId} className="group flex items-center justify-between px-5 py-2.5 hover:bg-zinc-50">
                  <span className="text-sm font-medium text-zinc-800 truncate mr-3">{r.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-zinc-400 tabular-nums">{r.contactValue}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${r.name}`}
                      onClick={() => {
                        setRemovedPersonIds((prev) => new Set([...prev, r.personId]));
                        setConfirmRecipients((prev) => prev ? prev.filter((x) => x.personId !== r.personId) : prev);
                      }}
                      className="flex h-5 w-5 items-center justify-center rounded text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-100 px-5 py-4">
            {confirmRecipients.length === 0 && (
              <p className="mb-3 text-xs text-amber-600">
                Add at least one recipient to send.
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmRecipients(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmedSend}
                disabled={confirmRecipients.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirm &amp; Send {channelLabel(channel)}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
