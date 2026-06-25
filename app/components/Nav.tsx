"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex h-12 items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold text-zinc-900 tracking-tight hover:text-zinc-600 transition-colors"
          >
            Kesher
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (pathname === "/" || pathname.startsWith("/audiences")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900")
              }
            >
              Audiences
            </Link>
            <Link
              href="/messages"
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (pathname.startsWith("/messages")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900")
              }
            >
              Messages
            </Link>
            <Link
              href="/people"
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (pathname.startsWith("/people")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900")
              }
            >
              Contacts
            </Link>
            <Link
              href="/groups"
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (pathname.startsWith("/groups")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900")
              }
            >
              Custom Audiences
            </Link>
            <Link
              href="/imports"
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (pathname.startsWith("/imports")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900")
              }
            >
              Import
            </Link>
            <Link
              href="/settings"
              className={
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                (pathname.startsWith("/settings")
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900")
              }
            >
              Settings
            </Link>
          </div>

          {/* Sign out */}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
