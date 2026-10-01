"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/login/actions";
import { Spinner } from "@/app/components/ui/Spinner";
import {
  LayoutDashboard,
  Users,
  Layers,
  MessageSquare,
  Activity,
  Upload,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";

type NavItemDef = {
  href: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>;
  exact?: boolean;
  extra?: string[];
};

const PRIMARY_NAV: NavItemDef[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/people", label: "People", icon: Users },
  { href: "/audiences", label: "Audiences", icon: Layers, extra: ["/groups"] },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/imports", label: "Imports", icon: Upload },
];

// ─── Collapsed state ──────────────────────────────────────────────────────────
// Source of truth is <html data-sidebar="collapsed">, set before first paint by
// the inline script in app/layout.tsx (so there's no width flash) and updated
// here. Persisted in localStorage; every access is wrapped in try/catch.

const STORAGE_KEY = "kesher.sidebar";
const CHANGE_EVENT = "kesher:sidebar";

function readCollapsed(): boolean {
  return document.documentElement.dataset.sidebar === "collapsed";
}

function setCollapsed(collapsed: boolean) {
  if (collapsed) document.documentElement.dataset.sidebar = "collapsed";
  else delete document.documentElement.dataset.sidebar;
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // Storage unavailable (private mode, blocked) — state still applies for this visit
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function useCollapsed(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(CHANGE_EVENT, cb);
      return () => window.removeEventListener(CHANGE_EVENT, cb);
    },
    readCollapsed,
    () => false
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-ink shadow-sm">
        <span className="text-[11px] font-bold text-on-ink tracking-tight">K</span>
      </div>
      <div className="nav-label min-w-0">
        <span className="block text-[13px] font-semibold text-ink tracking-tight leading-none">Kesher</span>
        <p className="text-[10px] text-ink-3 leading-none mt-0.5">School Comms</p>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  exact = false,
  extra = [],
  onNavigate,
}: NavItemDef & { onNavigate: () => void }) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/") || extra.some((p) => pathname.startsWith(p));

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={[
        "nav-item group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium",
        isActive
          ? "bg-brand-tint text-brand"
          : "text-ink-2 hover:bg-card hover:text-ink hover:shadow-card",
      ].join(" ")}
    >
      <Icon
        size={14}
        strokeWidth={isActive ? 2 : 1.75}
        className={`shrink-0 ${isActive ? "text-brand" : "text-ink-3 group-hover:text-ink-2"}`}
      />
      <span className="nav-label truncate">{label}</span>
      <span role="tooltip" className="nav-tip">{label}</span>
    </Link>
  );
}

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="nav-item group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium text-ink-3 hover:bg-card hover:text-ink-2 hover:shadow-card"
    >
      {pending ? (
        <Spinner size={14} className="text-ink-3" />
      ) : (
        <LogOut size={14} strokeWidth={1.75} className="shrink-0 text-ink-4 group-hover:text-ink-3" />
      )}
      <span className="nav-label">{pending ? "Signing out…" : "Sign out"}</span>
      <span role="tooltip" className="nav-tip">Sign out</span>
    </button>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const PUBLIC_PATHS = ["/", "/login", "/privacy", "/sms-terms", "/terms", "/contact", "/cta", "/opt-in", "/sample-form", "/unsubscribe"];

export function Nav() {
  const pathname = usePathname();
  const collapsed = useCollapsed();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cmd/Ctrl+B toggles the sidebar; Escape closes the mobile drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement | null;
        if (target?.isContentEditable) return;
        e.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) setCollapsed(!readCollapsed());
        else setMobileOpen((o) => !o);
      }
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/invite/") || pathname === "/no-workspace") return null;

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-card/95 px-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          className="-ml-1.5 rounded-lg p-1.5 text-ink-2 hover:bg-muted hover:text-ink"
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>
        <Wordmark />
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          aria-hidden
          onClick={closeMobile}
          className="animate-backdrop md:hidden fixed inset-0 z-40 bg-black/30"
        />
      )}

      <nav
        id="app-sidebar"
        aria-label="Main"
        data-open={mobileOpen ? "true" : undefined}
        className="app-sidebar fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-line bg-sidebar md:sticky md:top-0 md:z-20"
      >
        {/* Wordmark + collapse toggle */}
        <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4">
          <Wordmark />
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar (⌘B / Ctrl+B)" : "Collapse sidebar (⌘B / Ctrl+B)"}
            className="sidebar-toggle hidden md:inline-flex shrink-0 rounded-md p-1 text-ink-3 hover:bg-card hover:text-ink-2 hover:shadow-card"
          >
            {collapsed ? <PanelLeftOpen size={15} strokeWidth={1.75} /> : <PanelLeftClose size={15} strokeWidth={1.75} />}
          </button>
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Close menu"
            className="md:hidden shrink-0 rounded-md p-1 text-ink-3 hover:bg-card hover:text-ink-2"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* Section label */}
        <div className="nav-label px-4 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-4">Navigation</p>
        </div>

        {/* Primary nav */}
        <div className="sidebar-scroll flex-1 px-2.5 pb-2 space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.href} {...item} onNavigate={closeMobile} />
          ))}
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-line-2" />

        {/* Bottom nav */}
        <div className="px-2.5 py-3 space-y-0.5">
          <NavItem href="/settings" label="Settings" icon={Settings} onNavigate={closeMobile} />
          <form action={signOut} className="w-full">
            <SignOutButton />
          </form>
        </div>
      </nav>
    </>
  );
}
