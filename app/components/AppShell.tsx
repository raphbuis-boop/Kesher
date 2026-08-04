"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";

// Auth routes that should render without the sidebar Nav.
// AppFooter handles its own suppression via the same pattern.
const NO_NAV_ROUTES = ["/login", "/reset-password"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = NO_NAV_ROUTES.some((r) => pathname.startsWith(r));

  return hideNav ? (
    <>{children}</>
  ) : (
    <>
      <Nav />
      {children}
    </>
  );
}
