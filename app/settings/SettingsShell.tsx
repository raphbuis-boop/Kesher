"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import {
  User,
  School,
  Users,
  Radio,
  Database,
  SunMoon,
  TriangleAlert,
  Download,
  FileText,
  Trash2,
  Sun,
  Moon,
  Monitor,
  ArrowRight,
  Lock,
} from "lucide-react";
import type { BrandingSettings } from "@/lib/settings";
import type { ChannelStatus } from "./channels";
import type { ImportRow } from "./page";
import {
  changeEmail,
  changePassword,
  deleteAccount,
  removeLogo,
  saveLogo,
  saveSettings,
  updateProfileName,
  type SettingsState,
} from "./actions";
import { toast, useActionToast } from "@/app/components/ui/toast";
import { Spinner } from "@/app/components/ui/Spinner";
import { GlassDropzone, postWithProgress } from "@/app/components/ui/GlassDropzone";

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "school", label: "School", icon: School },
  { id: "team", label: "Team", icon: Users },
  { id: "channels", label: "Channels", icon: Radio },
  { id: "data", label: "Data", icon: Database },
  { id: "appearance", label: "Appearance", icon: SunMoon },
  { id: "danger", label: "Danger zone", icon: TriangleAlert },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const initialState: SettingsState = { success: false, error: null };

// ─── Shared bits ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink placeholder-line-strong outline-none transition-[border-color,background-color,box-shadow] duration-150 focus:border-ink-3 focus:bg-card focus:shadow-card disabled:opacity-50";

function Card({
  title,
  description,
  children,
  footer,
  tone = "default",
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={`rounded-xl border bg-card shadow-card ${tone === "danger" ? "border-red-500/30" : "border-line"}`}
    >
      <div className="px-5 pt-5">
        <h3 className={`text-[13px] font-semibold ${tone === "danger" ? "text-red-600" : "text-ink"}`}>{title}</h3>
        {description && <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-canvas px-5 py-3">{footer}</div>
      )}
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: React.ReactNode; pendingLabel: string }) {
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending && <Spinner />}
      {pending ? pendingLabel : children}
    </button>
  );
}

function StatusPill({ ok, okLabel = "Connected", badLabel = "Not connected" }: { ok: boolean; okLabel?: string; badLabel?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        ok ? "bg-emerald-500/10 text-emerald-700 [[data-theme=dark]_&]:text-emerald-400" : "bg-muted text-ink-2"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-ink-4"}`} />
      {ok ? okLabel : badLabel}
    </span>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function ProfileSection({ profile }: { profile: { name: string; email: string } }) {
  const [nameState, nameAction, namePending] = useActionState(updateProfileName, initialState);
  useActionToast(nameState, (s) => ({ success: s.success ? "Name saved" : null, error: s.error }));

  const [emailState, emailAction, emailPending] = useActionState(changeEmail, initialState);
  useActionToast(emailState, (s) => ({
    success: s.success ? "Check your new inbox to confirm the change" : null,
    error: s.error,
  }));

  const [pwState, pwAction, pwPending] = useActionState(changePassword, initialState);
  useActionToast(pwState, (s) => ({ success: s.success ? "Password updated" : null, error: s.error }));
  // Clear the password fields after a successful change
  const pwFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (pwState.success) pwFormRef.current?.reset();
  }, [pwState]);

  return (
    <div className="space-y-5">
      <form action={nameAction}>
        <Card
          title="Your name"
          description="Shown to you in Kesher. It isn't used in emails to parents — those use the school's sender name."
          footer={<SubmitButton pending={namePending} pendingLabel="Saving…">Save name</SubmitButton>}
        >
          <Field label="Full name" htmlFor="full_name">
            <input id="full_name" name="full_name" defaultValue={profile.name} placeholder="Rivka Cohen" className={inputCls} autoComplete="name" />
          </Field>
        </Card>
      </form>

      <form action={emailAction}>
        <Card
          title="Email address"
          description={
            <>
              You sign in with <span className="font-medium text-ink">{profile.email || "—"}</span>. Changing it sends a
              confirmation link to the new address; the change applies once you click it.
            </>
          }
          footer={<SubmitButton pending={emailPending} pendingLabel="Sending…">Change email</SubmitButton>}
        >
          <Field label="New email" htmlFor="new_email">
            <input id="new_email" name="email" type="email" required placeholder="you@yourschool.org" className={inputCls} autoComplete="email" />
          </Field>
          {emailState.success && (
            <p className="mt-3 text-[12px] text-emerald-700 [[data-theme=dark]_&]:text-emerald-400">
              Confirmation sent — check your new inbox.
            </p>
          )}
        </Card>
      </form>

      <form action={pwAction} ref={pwFormRef}>
        <Card
          title="Password"
          description="Use at least 8 characters."
          footer={<SubmitButton pending={pwPending} pendingLabel="Updating…">Update password</SubmitButton>}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password" htmlFor="current_password">
              <input id="current_password" name="current_password" type="password" required className={inputCls} autoComplete="current-password" />
            </Field>
            <Field label="New password" htmlFor="password">
              <input id="password" name="password" type="password" required minLength={8} className={inputCls} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm_password">
              <input id="confirm_password" name="confirm_password" type="password" required minLength={8} className={inputCls} autoComplete="new-password" />
            </Field>
          </div>
          {pwState.error && <p className="mt-3 text-[12px] text-red-600" role="alert">{pwState.error}</p>}
        </Card>
      </form>
    </div>
  );
}

// ─── School ───────────────────────────────────────────────────────────────────

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function logoFileName(url: string) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "logo");
  } catch {
    return "logo";
  }
}

function LogoCard({ logoUrl: initialUrl, uploadsEnabled }: { logoUrl: string; uploadsEnabled: boolean }) {
  const [logoUrl, setLogoUrl] = useState(initialUrl);

  return (
    <Card
      title="Logo"
      description="Shown at the top of every email. PNG or JPG, ideally on a transparent or white background, up to 2 MB."
    >
      <div className="grid gap-4 sm:grid-cols-[120px_1fr] sm:items-center">
        <div className="flex h-[88px] items-center justify-center rounded-lg border border-line bg-white p-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Current school logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[11px] text-zinc-400">No logo</span>
          )}
        </div>
        {uploadsEnabled ? (
          <GlassDropzone
            compact
            accept={LOGO_TYPES.join(",")}
            acceptLabel="a PNG, JPG, WebP or GIF image"
            isAccepted={(f) => LOGO_TYPES.includes(f.type)}
            maxBytes={2 * 1024 * 1024}
            title="Drop your logo here, or browse"
            hint="PNG, JPG, WebP or GIF · 2 MB max"
            initialFile={initialUrl ? { name: logoFileName(initialUrl), size: 0 } : null}
            onUpload={async (file, onProgress) => {
              const form = new FormData();
              form.append("file", file);
              form.append("purpose", "logo");
              const { url } = await postWithProgress<{ url: string }>("/api/upload", form, onProgress);
              const res = await saveLogo(url);
              if (!res.ok) throw new Error(res.error);
              setLogoUrl(url);
              toast.success(res.message);
            }}
            onRemove={async () => {
              const res = await removeLogo();
              if (!res.ok) {
                toast.error(res.error);
                throw new Error(res.error);
              }
              setLogoUrl("");
              toast.success(res.message);
            }}
          />
        ) : (
          <p className="text-[12px] leading-relaxed text-ink-2">
            Logo uploads need file storage (Vercel Blob, <code className="font-mono text-[11px]">BLOB_READ_WRITE_TOKEN</code>),
            which isn&apos;t configured. You can paste a public image URL in the school details below instead.
          </p>
        )}
      </div>
    </Card>
  );
}

function SchoolSection({ branding, uploadsEnabled }: { branding: BrandingSettings; uploadsEnabled: boolean }) {
  const [state, formAction, isPending] = useActionState(saveSettings, initialState);
  useActionToast(state, (s) => ({ success: s.success ? "School settings saved" : null, error: s.error }));
  const [color, setColor] = useState(branding.primaryColor || "#1e3a6e");

  return (
    <div className="space-y-5">
      <LogoCard logoUrl={branding.logoUrl} uploadsEnabled={uploadsEnabled} />

      <form action={formAction} noValidate className="space-y-5">
        <Card title="School details" description="Used in the email header, footer and as the sender name.">
          <div className="space-y-4">
            <Field label="School name" htmlFor="school_name" hint="Appears in the email header and as the sender name fallback.">
              <input id="school_name" name="school_name" defaultValue={branding.schoolName} placeholder="Heichal HaTorah" className={inputCls} disabled={isPending} />
            </Field>
            <Field label="Website" htmlFor="website_url" hint="Shown as a link in the email footer.">
              <input id="website_url" name="website_url" type="url" defaultValue={branding.websiteUrl} placeholder="https://yourschool.org" className={inputCls} disabled={isPending} />
            </Field>
            <Field label="Footer text / address" htmlFor="footer_text" hint="Appears at the bottom of every email — your address, phone or a short tagline.">
              <textarea id="footer_text" name="footer_text" rows={3} defaultValue={branding.footerText} placeholder="123 Main Street · Teaneck, NJ · (201) 555-0100" className={`${inputCls} resize-none leading-relaxed`} disabled={isPending} />
            </Field>
            {!uploadsEnabled && (
              <Field label="Logo URL" htmlFor="school_logo_url" hint="Must be a public image URL.">
                <input id="school_logo_url" name="school_logo_url" type="url" defaultValue={branding.logoUrl} placeholder="https://yourschool.org/logo.png" className={inputCls} disabled={isPending} />
              </Field>
            )}
          </div>
        </Card>

        <Card title="Email sending" description="How your emails appear in parents' inboxes.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sender name" htmlFor="sender_name" hint="The “From” name. Falls back to the school name.">
              <input id="sender_name" name="sender_name" defaultValue={branding.senderName} placeholder="Heichal HaTorah" className={inputCls} disabled={isPending} />
            </Field>
            <Field label="Reply-to email" htmlFor="reply_to_email" hint="Parent replies go here.">
              <input id="reply_to_email" name="reply_to_email" type="email" defaultValue={branding.replyToEmail} placeholder="office@yourschool.org" className={inputCls} disabled={isPending} />
            </Field>
            <Field label="Sender email" htmlFor="sender_email" hint="Must be on your verified sending domain; otherwise it's used as the reply-to.">
              <input id="sender_email" name="sender_email" type="email" defaultValue={branding.senderEmail} placeholder="hello@kesherhq.co" className={inputCls} disabled={isPending} />
            </Field>
            <Field label="Header colour" htmlFor="primary_color" hint="Email header background.">
              <div className="flex items-center gap-3">
                <input
                  id="primary_color"
                  name="primary_color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-card p-1 disabled:opacity-50"
                  disabled={isPending}
                />
                <span className="font-mono text-[12px] text-ink-2">{color}</span>
              </div>
            </Field>
          </div>
          {state.error && <p className="mt-4 text-[12px] text-red-600" role="alert">{state.error}</p>}
        </Card>

        <div className="flex justify-end">
          <SubmitButton pending={isPending} pendingLabel="Saving…">Save school settings</SubmitButton>
        </div>
      </form>
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

function TeamSection({ profile, role, memberSince }: { profile: { name: string; email: string }; role: string; memberSince: string | null }) {
  return (
    <Card title="Team" description="People who can sign in to this school's workspace.">
      <div className="flex items-center gap-3 rounded-lg border border-line px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted-2 text-[11px] font-semibold text-ink-2">
          {(profile.name || profile.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink">
            {profile.name || profile.email} <span className="font-normal text-ink-3">(you)</span>
          </p>
          <p className="truncate text-[11px] text-ink-3">
            {profile.email}
            {memberSince ? ` · since ${new Date(memberSince).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-2">{role}</span>
      </div>
      <div className="mt-4 flex gap-2.5 rounded-lg bg-canvas px-4 py-3 text-[12px] leading-relaxed text-ink-2">
        <Lock size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
        <p>
          Inviting teammates isn&apos;t available yet. Right now each Kesher login has its own school workspace, so
          invites, roles and removing users will arrive with shared-workspace support.
        </p>
      </div>
    </Card>
  );
}

// ─── Channels ─────────────────────────────────────────────────────────────────

function ChannelsSection({ channels, simulated }: { channels: ChannelStatus[]; simulated: boolean }) {
  return (
    <div className="space-y-5">
      {simulated && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 [[data-theme=dark]_&]:text-amber-300">
          Sends are simulated for this workspace (demo mode) — no real messages go out.
        </div>
      )}
      <Card title="Channels" description="Read-only. Channels are configured by Kesher on the server.">
        <ul className="divide-y divide-line">
          {channels.map((c) => (
            <li key={c.key} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{c.label}</p>
                {c.detail.length > 0 ? (
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
                    {c.detail.map((d) => (
                      <div key={d.label} className="contents">
                        <dt className="text-ink-3">{d.label}</dt>
                        <dd className="truncate font-mono text-[11.5px] text-ink-soft">{d.value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  c.problem && <p className="mt-1 text-[12px] text-ink-3">{c.problem}</p>
                )}
              </div>
              <StatusPill ok={c.connected} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

function DataSection({ imports, logoUrl }: { imports: ImportRow[]; logoUrl: string }) {
  const [logo, setLogo] = useState(logoUrl);
  const [isDeleting, startDelete] = useTransition();
  const isStoredLogo = /\.public\.blob\.vercel-storage\.com\/logos\//.test(logo);

  return (
    <div className="space-y-5">
      <Card
        title="Export contacts"
        description="Download every contact in your directory as a CSV file (name, email, phone, WhatsApp, grade, audiences, tags)."
      >
        <a href="/api/export/contacts" download className="btn btn-secondary">
          <Download size={13} strokeWidth={2} />
          Export all contacts (.csv)
        </a>
      </Card>

      <Card
        title="Import history"
        description="Your 10 most recent CSV imports."
        footer={
          <Link href="/imports" className="btn btn-ghost btn-sm">
            All imports <ArrowRight size={12} strokeWidth={2} />
          </Link>
        }
      >
        {imports.length === 0 ? (
          <p className="text-[12px] text-ink-3">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {imports.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <FileText size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{i.file_name}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-2">{i.imported_count.toLocaleString()} added</span>
                <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-3 sm:inline">
                  {new Date(i.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Uploaded files"
        description="Files Kesher stores for your school. Imported CSVs are read in your browser and never stored; message attachments aren't tracked per school yet, so they can't be listed here."
      >
        {isStoredLogo ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-line bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{logoFileName(logo)}</p>
              <p className="text-[11px] text-ink-3">School logo</p>
            </div>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() =>
                startDelete(async () => {
                  const res = await removeLogo();
                  if (res.ok) {
                    setLogo("");
                    toast.success("Logo file deleted");
                  } else toast.error(res.error);
                })
              }
              className="btn btn-secondary btn-sm hover:!text-red-600"
            >
              {isDeleting ? <Spinner size={11} /> : <Trash2 size={12} strokeWidth={2} />}
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-ink-3">No stored files.</p>
        )}
      </Card>
    </div>
  );
}

// ─── Appearance ───────────────────────────────────────────────────────────────

type ThemePref = "light" | "dark" | "system";
const THEME_EVENT = "kesher:theme";

declare global {
  interface Window {
    __kesherTheme?: (pref: ThemePref) => void;
  }
}

function readThemePref(): ThemePref {
  const v = document.documentElement.dataset.themePref;
  return v === "dark" || v === "system" ? v : "light";
}

function AppearanceSection() {
  const pref = useSyncExternalStore(
    (cb) => {
      window.addEventListener(THEME_EVENT, cb);
      return () => window.removeEventListener(THEME_EVENT, cb);
    },
    readThemePref,
    () => "light" as ThemePref
  );

  function choose(next: ThemePref) {
    try {
      localStorage.setItem("kesher.theme", next);
    } catch {
      // Storage unavailable — still applies for this visit
    }
    window.__kesherTheme?.(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const options: { value: ThemePref; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <Card title="Theme" description="Saved on this device. System follows your computer's light or dark setting.">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {options.map(({ value, label, icon: Icon }) => {
          const active = pref === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(value)}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-[12px] font-medium transition-[border-color,background-color,box-shadow] duration-150 ${
                active ? "border-brand bg-brand-tint text-brand shadow-card" : "border-line text-ink-2 hover:bg-muted hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerSection({ schoolName, role }: { schoolName: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, isPending] = useActionState(deleteAccount, initialState);
  useActionToast(state, (s) => ({ error: s.error }));
  const expected = schoolName.trim() || "delete my account";
  const matches = typed.trim().toLowerCase() === expected.toLowerCase();

  if (role !== "owner") {
    return (
      <Card title="Delete account" tone="danger" description="Only the account owner can delete this workspace.">
        <p className="text-[12px] text-ink-3">Ask the owner if you need the account deleted.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Delete account"
      tone="danger"
      description="Permanently deletes your school's workspace and your login. This can't be undone."
    >
      <ul className="mb-4 list-disc space-y-1 pl-5 text-[12px] leading-relaxed text-ink-2">
        <li>All contacts, tags, relationships and audiences</li>
        <li>All sent messages and their delivery/recipient history</li>
        <li>Import history, school settings and the uploaded logo</li>
        <li>Your Kesher login</li>
      </ul>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-danger">
          <Trash2 size={13} strokeWidth={2} />
          Delete account…
        </button>
      ) : (
        <form action={formAction} className="animate-pop-in space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <label htmlFor="confirmation" className="block text-[12px] text-ink-soft">
            Type <span className="font-semibold text-ink">{expected}</span> to confirm.
          </label>
          <input
            id="confirmation"
            name="confirmation"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
            className={inputCls}
            disabled={isPending}
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setTyped(""); }} disabled={isPending} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={!matches || isPending} className="btn btn-danger">
              {isPending && <Spinner />}
              {isPending ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function isSection(v: string): v is SectionId {
  return SECTIONS.some((s) => s.id === v);
}

export function SettingsShell({
  profile,
  branding,
  role,
  memberSince,
  channels,
  simulated,
  imports,
  logoUploadsEnabled,
}: {
  profile: { name: string; email: string };
  branding: BrandingSettings;
  role: string;
  memberSince: string | null;
  channels: ChannelStatus[];
  simulated: boolean;
  imports: ImportRow[];
  logoUploadsEnabled: boolean;
}) {
  // Active section lives in the URL hash (/settings#school) so it deep-links
  const active = useSyncExternalStore(
    (cb) => {
      window.addEventListener("hashchange", cb);
      return () => window.removeEventListener("hashchange", cb);
    },
    () => {
      const h = window.location.hash.slice(1);
      return isSection(h) ? h : "profile";
    },
    () => "profile" as SectionId
  );

  function select(id: SectionId) {
    history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  const current = SECTIONS.find((s) => s.id === active)!;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6 md:grid md:grid-cols-[190px_1fr] md:gap-8">
      {/* Section list — left column on desktop, scrolling tabs on mobile */}
      <nav aria-label="Settings sections" className="mb-5 md:mb-0">
        <div role="tablist" aria-orientation="vertical" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:sticky md:top-20 md:mx-0 md:flex-col md:overflow-visible md:px-0">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={isActive}
                aria-controls="settings-panel"
                onClick={() => select(id)}
                className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-[7px] text-[13px] font-medium md:w-full ${
                  isActive
                    ? id === "danger"
                      ? "bg-red-500/10 text-red-600"
                      : "bg-card text-ink shadow-card ring-1 ring-line"
                    : id === "danger"
                      ? "text-red-600/80 hover:bg-red-500/10"
                      : "text-ink-2 hover:bg-muted hover:text-ink"
                }`}
              >
                <Icon size={14} strokeWidth={isActive ? 2 : 1.75} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <div id="settings-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="min-w-0">
        <h2 className="mb-4 text-[15px] font-semibold tracking-tight text-ink">{current.label}</h2>
        <div key={active} className="animate-page-in">
          {active === "profile" && <ProfileSection profile={profile} />}
          {active === "school" && <SchoolSection branding={branding} uploadsEnabled={logoUploadsEnabled} />}
          {active === "team" && <TeamSection profile={profile} role={role} memberSince={memberSince} />}
          {active === "channels" && <ChannelsSection channels={channels} simulated={simulated} />}
          {active === "data" && <DataSection imports={imports} logoUrl={branding.logoUrl} />}
          {active === "appearance" && <AppearanceSection />}
          {active === "danger" && <DangerSection schoolName={branding.schoolName} role={role} />}
        </div>
      </div>
    </div>
  );
}
