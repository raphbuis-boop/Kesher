"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";

// Auth routes that should render without the sidebar Nav.
// AppFooter handles its own suppression via the same pattern.
const NO_NAV_ROUTES = ["/login", "/reset-password", "/forgot-password", "/onboarding"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/" || NO_NAV_ROUTES.some((r) => pathname.startsWith(r));

  return hideNav ? (
    <>{children}</>
  ) : (
    // `contents` keeps the body's flex layout; the wrapper scopes the app's
    // semantic colour tokens (and dark mode) to the signed-in interior.
    <div className="app-shell contents text-ink">
      <Nav />
      {children}
    </div>
  );
}
