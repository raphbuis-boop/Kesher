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
        "group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-all duration-100",
        isActive
          ? "bg-[#f0f0f0] text-[#0f0f0f]"
          : "text-[#71717a] hover:bg-[#f5f5f5] hover:text-[#0f0f0f]",
      ].join(" ")}
    >
      <Icon
        size={14}
        strokeWidth={isActive ? 2 : 1.75}
        className={isActive ? "text-[#0f0f0f]" : "text-[#a1a1aa] group-hover:text-[#71717a] transition-colors"}
      />
      {label}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="sticky top-0 h-screen w-[216px] shrink-0 flex flex-col border-r border-[#e7e7e7] bg-white overflow-y-auto">
      {/* Wordmark */}
      <div className="px-4 pt-[18px] pb-4 border-b border-[#f0f0f0]">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-[#0f0f0f]">
            <span className="text-[10px] font-bold text-white tracking-tight">K</span>
          </div>
          <span className="text-[13px] font-semibold text-[#0f0f0f] tracking-tight">Kesher</span>
        </div>
      </div>

      {/* Primary nav */}
      <div className="flex-1 px-2.5 pt-3 pb-2 space-y-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-[#f0f0f0] px-2.5 py-3 space-y-0.5">
        <NavItem href="/settings" label="Settings" icon={Settings} />
        <form action={signOut} className="w-full">
          <button
            type="submit"
            className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-[#a1a1aa] transition-all duration-100 hover:bg-[#f5f5f5] hover:text-[#71717a]"
          >
            <LogOut size={14} strokeWidth={1.75} className="transition-colors" />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
