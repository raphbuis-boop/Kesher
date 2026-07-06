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
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
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
      className={[
        "group flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium",
        isActive
          ? "bg-[#eff6ff] text-[#2563eb]"
          : "text-[#71717a] hover:bg-white hover:text-[#0f0f0f] hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
      ].join(" ")}
    >
      <Icon
        size={14}
        strokeWidth={isActive ? 2 : 1.75}
        className={isActive ? "text-[#2563eb]" : "text-[#a1a1aa] group-hover:text-[#71717a]"}
      />
      {label}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  // Public pages — no app chrome
  if (pathname === "/login" || pathname === "/privacy" || pathname === "/sms-terms" || pathname === "/terms") return null;

  return (
    <nav
      className="sticky top-0 h-screen w-[220px] shrink-0 flex flex-col border-r border-[#e7e7e7] overflow-y-auto"
      style={{ background: "var(--sidebar-bg)" }}
    >
      {/* Wordmark */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#0f0f0f] shadow-sm">
            <span className="text-[11px] font-bold text-white tracking-tight">K</span>
          </div>
          <div>
            <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight leading-none">Kesher</span>
            <p className="text-[10px] text-[#a1a1aa] leading-none mt-0.5">School Comms</p>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="px-4 pb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c4c4c8]">Navigation</p>
      </div>

      {/* Primary nav */}
      <div className="flex-1 px-2.5 pb-2 space-y-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-[#ebebeb]" />

      {/* Bottom nav */}
      <div className="px-2.5 py-3 space-y-0.5">
        <NavItem href="/settings" label="Settings" icon={Settings} />
        <form action={signOut} className="w-full">
          <button
            type="submit"
            className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium text-[#a1a1aa] hover:bg-white hover:text-[#71717a] hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            <LogOut size={14} strokeWidth={1.75} className="text-[#c4c4c8] group-hover:text-[#a1a1aa]" />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
