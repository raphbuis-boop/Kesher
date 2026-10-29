"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { PROVIDERS } from "@/lib/sync/connectors";

/** Records that this school wants a connector (one request per provider; asking twice is a no-op). */
export async function requestIntegration(provider: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let orgId: string;
  let userId: string;
  try {
    ({ orgId, userId } = await requireRole(ADMIN_ROLES));
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
  if (!PROVIDERS.some((p) => p.kind === provider)) return { ok: false, error: "Unknown integration." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("integration_requests")
    .upsert({ org_id: orgId, provider, requested_by: userId }, { onConflict: "org_id,provider", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function cancelIntegrationRequest(provider: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let orgId: string;
  try {
    ({ orgId } = await requireRole(ADMIN_ROLES));
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("integration_requests").delete().eq("org_id", orgId).eq("provider", provider);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
