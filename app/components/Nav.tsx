"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

// ─── Icons ────────────────────────────────────────────────────────────────────

function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" strokeLinecap="round" />
      <path d="M11 3.5a2.5 2.5 0 0 1 0 5M14.5 13.5c0-2-1.5-3.5-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function AudiencesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 13.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
      <circle cx="3" cy="4.5" r="1.5" />
      <circle cx="13" cy="4.5" r="1.5" />
    </svg>
  );
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M14 2H2a.5.5 0 0 0-.5.5v9A.5.5 0 0 0 2 12h3l3 2.5L11 12h3a.5.5 0 0 0 .5-.5v-9A.5.5 0 0 0 14 2Z" />
      <path d="M5 6.5h6M5 9h4" strokeLinecap="round" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M1.5 8h2.25l1.5-4.5 3 9 1.5-4.5H14.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M8 2v8M5.5 7.5 8 10l2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11v1.5A.5.5 0 0 0 3 13h10a.5.5 0 0 0 .5-.5V11" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" strokeLinecap="round" />
    </svg>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  exact = false,
  extra = [],
}: {
  href: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  exact?: boolean;
  extra?: string[];
}) {
  const pathname = usePathname();
  const isActive =
    exact
      ? pathname === href
      : pathname === href ||
        pathname.startsWith(href + "/") ||
        extra.some((p) => pathname.startsWith(p));

  return (
    <Link
      href={href}
      className={
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors " +
        (isActive
          ? "bg-zinc-100 text-zinc-900 font-medium"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800")
      }
    >
      <Icon className="h-[15px] w-[15px] shrink-0" />
      {label}
    </Link>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="sticky top-0 h-screen w-[220px] shrink-0 flex flex-col border-r border-zinc-100 bg-white overflow-y-auto">
      {/* Wordmark */}
      <div className="px-4 pt-5 pb-5">
        <span className="text-[13px] font-semibold text-zinc-900 tracking-tight">
          Kesher
        </span>
      </div>

      {/* Primary nav */}
      <div className="flex-1 px-3 space-y-0.5">
        <NavItem href="/" label="Overview" icon={OverviewIcon} exact />
        <NavItem href="/people" label="People" icon={PeopleIcon} />
        <NavItem href="/audiences" label="Audiences" icon={AudiencesIcon} extra={["/groups"]} />
        <NavItem href="/messages" label="Messages" icon={MessagesIcon} />
        <NavItem href="/activity" label="Activity" icon={ActivityIcon} />
        <NavItem href="/imports" label="Imports" icon={ImportsIcon} />
      </div>

      {/* Bottom nav */}
      <div className="border-t border-zinc-100 px-3 py-3 space-y-0.5">
        <NavItem href="/settings" label="Settings" icon={SettingsIcon} />
        <form action={signOut} className="w-full">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
          >
            <svg className="h-[15px] w-[15px] shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M6 2.5H3a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h3M10.5 11l3-3-3-3M13.5 8H6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
