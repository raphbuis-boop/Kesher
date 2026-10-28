"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LayoutTemplate, Pencil, Plus, Trash2, X } from "lucide-react";
import { GlassDropzone, postWithProgress } from "@/app/components/ui/GlassDropzone";
import { Spinner } from "@/app/components/ui/Spinner";
import { toast } from "@/app/components/ui/toast";
import type { MessageTemplate } from "@/lib/templates";
import { createTemplate, deleteTemplate, duplicateTemplate, setTemplateAudiences, updateTemplate, type TemplateInput } from "../templateActions";
import { FieldLabel, Panel, inputCls, useAction } from "./ui";

export type AudienceChoice = { slug: string; label: string; custom: boolean };

type Props = {
  templates: MessageTemplate[];
  /** audience slug → template id */
  assignments: Record<string, string>;
  audiences: AudienceChoice[];
  brand: { schoolName: string; primaryColor: string; logoUrl: string; footerText: string; senderName: string };
  uploadsEnabled: boolean;
};

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function emptyInput(): TemplateInput {
  return { name: "", logo_url: "", primary_color: "", background_color: "", sender_name: "", default_subject: "", footer_text: "" };
}

/** What the email header and footer will look like, with inherited values filled in. */
function MiniPreview({ t, brand }: { t: TemplateInput; brand: Props["brand"] }) {
  const color = t.primary_color || brand.primaryColor || "#1e3a6e";
  const bg = t.background_color || "#eef0f3";
  const logo = t.logo_url || brand.logoUrl;
  const school = brand.schoolName || "Your school";
  const initials = school.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const footer = t.footer_text || brand.footerText;
  return (
    <div className="overflow-hidden rounded-lg border border-line" style={{ background: bg }} aria-label="Template preview">
      <div className="mx-auto max-w-[280px] py-3">
        <div className="rounded-t-lg px-4 py-4 text-center" style={{ background: color }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="mx-auto max-h-10 max-w-[160px] rounded bg-white px-2 py-1 object-contain" />
          ) : (
            <>
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-[12px] font-bold text-white">{initials}</span>
              <p className="mt-1.5 text-[12px] font-bold text-white">{school}</p>
            </>
          )}
        </div>
        <div className="space-y-1.5 bg-white px-4 py-3">
          {t.default_subject && <p className="text-[11px] font-semibold text-zinc-800">{t.default_subject}</p>}
          <div className="h-1.5 w-11/12 rounded bg-zinc-200" />
          <div className="h-1.5 w-full rounded bg-zinc-200" />
          <div className="h-1.5 w-2/3 rounded bg-zinc-200" />
        </div>
        <div className="rounded-b-lg bg-zinc-50 px-4 py-2.5 text-center">
          <p className="text-[9.5px] font-semibold text-zinc-600">{school}</p>
          {footer && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[9px] text-zinc-500">{footer}</p>}
          <p className="mt-1 text-[8.5px] text-zinc-400">From: {t.sender_name || brand.senderName || school}</p>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <FieldLabel label={label} hint="Leave blank to use your school's color.">
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : placeholder} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 cursor-pointer rounded-md border border-line bg-canvas p-1" aria-label={`${label} picker`} />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} font-mono`} maxLength={7} />
        {value && <button type="button" onClick={() => onChange("")} className="btn btn-ghost btn-sm">Clear</button>}
      </div>
    </FieldLabel>
  );
}

function Editor({
  template,
  assigned,
  audiences,
  brand,
  uploadsEnabled,
  onClose,
}: {
  template: MessageTemplate | null;
  assigned: string[];
  audiences: AudienceChoice[];
  brand: Props["brand"];
  uploadsEnabled: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [t, setT] = useState<TemplateInput>(
    template
      ? {
          name: template.name,
          logo_url: template.logo_url ?? "",
          primary_color: template.primary_color ?? "",
          background_color: template.background_color ?? "",
          sender_name: template.sender_name ?? "",
          default_subject: template.default_subject ?? "",
          footer_text: template.footer_text ?? "",
        }
      : emptyInput()
  );
  const [slugs, setSlugs] = useState<string[]>(assigned);
  const { pending, run } = useAction();
  const set = (patch: Partial<TemplateInput>) => setT((x) => ({ ...x, ...patch }));

  function save() {
    run(
      async () => {
        const res = template ? await updateTemplate(template.id, t) : await createTemplate(t);
        if (!res.ok) return res;
        const id = template?.id ?? res.id!;
        const aud = await setTemplateAudiences(id, slugs);
        return aud.ok ? { ok: true as const } : aud;
      },
      template ? "Template saved" : "Template created",
      () => {
        onClose();
        router.refresh();
      }
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-line bg-canvas p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-ink">{template ? `Edit "${template.name}"` : "New template"}</h4>
        <button type="button" onClick={onClose} aria-label="Close editor" className="rounded-md p-1 text-ink-3 hover:bg-muted"><X size={14} /></button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <FieldLabel label="Template name">
            <input value={t.name} onChange={(e) => set({ name: e.target.value })} placeholder="Basketball team" className={inputCls} maxLength={80} autoFocus />
          </FieldLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Header color" value={t.primary_color} onChange={(v) => set({ primary_color: v })} placeholder={brand.primaryColor || "#1e3a6e"} />
            <ColorField label="Page background" value={t.background_color} onChange={(v) => set({ background_color: v })} placeholder="#eef0f3" />
          </div>

          <FieldLabel label="Logo / header image" hint="Replaces your school logo in the header. PNG or JPG, up to 2 MB. Leave blank to use the school logo.">
            {uploadsEnabled ? (
              <GlassDropzone
                compact
                accept={LOGO_TYPES.join(",")}
                acceptLabel="a PNG, JPG, WebP or GIF image"
                isAccepted={(f) => LOGO_TYPES.includes(f.type)}
                maxBytes={2 * 1024 * 1024}
                title="Drop an image here, or browse"
                hint="PNG, JPG, WebP or GIF · 2 MB max"
                initialFile={t.logo_url ? { name: decodeURIComponent(t.logo_url.split("/").pop() ?? "logo"), size: 0 } : null}
                onUpload={async (file, onProgress) => {
                  const form = new FormData();
                  form.append("file", file);
                  form.append("purpose", "logo");
                  const { url } = await postWithProgress<{ url: string }>("/api/upload", form, onProgress);
                  set({ logo_url: url });
                }}
                onRemove={() => set({ logo_url: "" })}
              />
            ) : (
              <input value={t.logo_url} onChange={(e) => set({ logo_url: e.target.value })} placeholder="https://…/logo.png" className={inputCls} />
            )}
          </FieldLabel>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldLabel label="Sender name" hint={`Shown as the From name. Blank = ${brand.senderName || brand.schoolName || "your school name"}.`}>
              <input value={t.sender_name} onChange={(e) => set({ sender_name: e.target.value })} placeholder="Yeshiva Basketball" className={inputCls} maxLength={100} />
            </FieldLabel>
            <FieldLabel label="Default subject" hint="Pre-fills the subject line when this template is used.">
              <input value={t.default_subject} onChange={(e) => set({ default_subject: e.target.value })} placeholder="Practice update" className={inputCls} maxLength={200} />
            </FieldLabel>
          </div>

          <FieldLabel label="Footer" hint="Replaces your school's footer text (address, etc.) for this template. The unsubscribe link is always included.">
            <textarea value={t.footer_text} onChange={(e) => set({ footer_text: e.target.value })} rows={3} className={`${inputCls} resize-none`} maxLength={1000} />
          </FieldLabel>

          <div>
            <p className="mb-1.5 text-[12px] font-medium text-ink-soft">Use by default for these audiences</p>
            <p className="mb-2 text-[11px] text-ink-3">When someone composes to one of these, this template is picked automatically (they can still change it).</p>
            <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {audiences.map((a) => (
                <label key={a.slug} className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                  <input
                    type="checkbox"
                    checked={slugs.includes(a.slug)}
                    onChange={(e) => setSlugs((s) => (e.target.checked ? [...s, a.slug] : s.filter((x) => x !== a.slug)))}
                    className="h-3.5 w-3.5 accent-[var(--app-ink)]"
                  />
                  <span className="truncate">{a.label}</span>
                  {a.custom && <span className="text-[10px] text-ink-3">custom</span>}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Preview</p>
          <MiniPreview t={t} brand={brand} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button type="button" disabled={pending || !t.name.trim()} onClick={save} className="btn btn-primary">
          {pending && <Spinner />} {template ? "Save template" : "Create template"}
        </button>
      </div>
    </div>
  );
}

export function TemplatesSettings({ templates, assignments, audiences, brand, uploadsEnabled }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<MessageTemplate | "new" | null>(null);
  const { pending, run } = useAction();
  const labelFor = (slug: string) => audiences.find((a) => a.slug === slug)?.label ?? slug;

  return (
    <Panel
      title="Email templates"
      description="A template is the look of a message — header, colors, sender name, footer. Make one per group (the whole school, the basketball team, the PTA) and set which audiences use it by default. Anything you leave blank uses your school's settings."
    >
      {templates.length === 0 && editing === null && (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line px-6 py-10 text-center">
          <LayoutTemplate size={18} className="mb-3 text-line-strong" />
          <p className="text-[13px] font-semibold text-ink">No templates yet</p>
          <p className="mt-1 max-w-sm text-[12px] text-ink-3">Messages use your School settings until you add one. Add a template for a group that should look different.</p>
        </div>
      )}

      {templates.length > 0 && (
        <ul className="divide-y divide-line">
          {templates.map((t) => {
            const used = Object.entries(assignments).filter(([, id]) => id === t.id).map(([slug]) => labelFor(slug));
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="h-8 w-8 shrink-0 rounded-md border border-line" style={{ background: t.primary_color || brand.primaryColor || "#1e3a6e" }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">{t.name}</p>
                  <p className="truncate text-[11px] text-ink-3">
                    {used.length > 0 ? `Default for ${used.join(", ")}` : "Not a default for any audience"}
                    {t.sender_name ? ` · From ${t.sender_name}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing(t)} className="btn btn-secondary btn-sm"><Pencil size={11} /> Edit</button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(async () => { const r = await duplicateTemplate(t.id); return r.ok ? { ok: true as const, message: r.message } : r; }, "Duplicated", () => router.refresh())}
                  className="btn btn-ghost btn-sm"
                >
                  <Copy size={11} /> Duplicate
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`Delete "${t.name}"? Messages already sent keep their look. Audiences using it go back to your school settings.`)) {
                      run(async () => { const r = await deleteTemplate(t.id); return r.ok ? { ok: true as const } : r; }, "Template deleted", () => router.refresh());
                    }
                  }}
                  aria-label={`Delete ${t.name}`}
                  className="rounded-md p-1.5 text-ink-3 hover:bg-muted hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null ? (
        <div className={templates.length > 0 ? "mt-5" : "mt-4"}>
          <Editor
            key={editing === "new" ? "new" : editing.id}
            template={editing === "new" ? null : editing}
            assigned={editing === "new" ? [] : Object.entries(assignments).filter(([, id]) => id === editing.id).map(([slug]) => slug)}
            audiences={audiences}
            brand={brand}
            uploadsEnabled={uploadsEnabled}
            onClose={() => setEditing(null)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className={`btn btn-primary ${templates.length > 0 ? "mt-4" : "mt-4"}`}>
          <Plus size={12} strokeWidth={2.5} /> New template
        </button>
      )}
    </Panel>
  );
}
