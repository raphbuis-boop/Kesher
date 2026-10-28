import { getMembership, isAdminRole } from "@/lib/org";

/** Renders children only for the school's owner/admins (server component). */
export async function AdminOnly({ children }: { children: React.ReactNode }) {
  const { role } = await getMembership();
  return isAdminRole(role) ? <>{children}</> : null;
}
