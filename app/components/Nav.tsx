"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import {
  LayoutDashboard,
  Users,
  Layers,
  MessageSquare,
  Activity,
  Upload,
  Settings,
  LogOut,
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

function NavItem({ href, label, icon: Icon, exact = false, extra = [] }: NavItemDef) {
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
      aria-current={isActive ? "page" : undefined}
      className={[
        "group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium",
        isActive
          ? "bg-accent-tint text-accent"
          : "text-text-muted hover:bg-surface hover:text-text-primary hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
      ].join(" ")}
    >
      <Icon
        aria-hidden
        size={14}
        strokeWidth={isActive ? 2 : 1.75}
        className={isActive ? "text-accent" : "text-text-subtle group-hover:text-text-muted"}
      />
      {label}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  // Public pages — no app chrome
  if (pathname === "/" || pathname === "/home" || pathname === "/login" || pathname === "/privacy" || pathname === "/sms-terms" || pathname === "/terms" || pathname === "/contact" || pathname === "/cta" || pathname === "/opt-in" || pathname === "/sample-form") return null;

  return (
    <nav
      aria-label="Main"
      className="sticky top-0 h-screen w-[220px] shrink-0 flex flex-col border-r border-border overflow-y-auto"
      style={{ background: "var(--sidebar-bg)" }}
    >
      {/* Wordmark */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div aria-hidden className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-primary shadow-sm">
            <span className="text-[11px] font-bold text-primary-fg tracking-tight">K</span>
          </div>
          <div>
            <span className="text-[13px] font-semibold text-text-primary tracking-tight leading-none">Kesher</span>
            <p className="text-[10px] text-text-subtle leading-none mt-0.5">School Comms</p>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <div className="flex-1 px-2.5 pb-2 space-y-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-border" />

      {/* Bottom nav */}
      <div className="px-2.5 py-3 space-y-0.5">
        <NavItem href="/settings" label="Settings" icon={Settings} />
        <form action={signOut} className="w-full">
          <button
            type="submit"
            className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium text-text-muted hover:bg-surface hover:text-text-primary hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            <LogOut aria-hidden size={14} strokeWidth={1.75} className="text-text-subtle group-hover:text-text-muted" />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
