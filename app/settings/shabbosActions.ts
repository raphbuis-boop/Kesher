"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ADMIN_ROLES, PermissionError, requireRole } from "@/lib/org";
import { parseLocationInput } from "@/lib/hebcal";
import { getShabbosSettings, refreshWindows } from "@/lib/shabbos";

export type ShabbosResult = { ok: true; message?: string } | { ok: false; error: string };

export type ShabbosInput = {
  enabled: boolean;
  /** A ZIP code, or a Hebcal location ID for anywhere else */
  location: string;
  israelSchedule: boolean;
  candleMinutes: number;
  havdalahMode: "minutes" | "tzeis";
  havdalahMinutes: number;
  bufferMinutes: number;
};

const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function saveShabbosSettings(input: ShabbosInput): Promise<ShabbosResult> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    const where = parseLocationInput(input.location);
    if (input.enabled && !where) return { ok: false, error: "Enter your school's ZIP code, or its Hebcal location number if it's outside the US." };

    const supabase = await createSupabaseServerClient();
    const before = await getShabbosSettings(supabase, orgId);
    const row = {
      org_id: orgId,
      enabled: input.enabled,
      geo_kind: where?.geoKind ?? before?.geoKind ?? "zip",
      zip: where?.geoKind === "zip" ? where.zip : where ? null : (before?.zip ?? null),
      geonameid: where?.geoKind === "geoname" ? where.geonameid : where ? null : (before?.geonameid ?? null),
      israel_schedule: !!input.israelSchedule,
      candle_minutes: int(input.candleMinutes, 0, 90, 18),
      havdalah_mode: input.havdalahMode === "tzeis" ? "tzeis" : "minutes",
      havdalah_minutes: int(input.havdalahMinutes, 20, 120, 50),
      buffer_minutes: int(input.bufferMinutes, 0, 240, 30),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("org_shabbos").upsert(row, { onConflict: "org_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings");
    revalidatePath("/dashboard");

    if (!input.enabled) return { ok: true, message: "Shabbos & Yom Tov mode is off." };
    const settings = await getShabbosSettings(supabase, orgId);
    if (!settings) return { ok: true };
    const res = await refreshWindows(createSupabaseAdminClient(), orgId, settings);
    revalidatePath("/settings");
    if (!res.ok) return { ok: false, error: `Saved, but couldn't load the times from Hebcal: ${res.error}` };
    return { ok: true, message: `Saved. Loaded ${res.windows} Shabbos and Yom Tov periods.` };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function refreshShabbosTimes(): Promise<ShabbosResult> {
  try {
    const { orgId } = await requireRole(ADMIN_ROLES);
    const supabase = await createSupabaseServerClient();
    const settings = await getShabbosSettings(supabase, orgId);
    if (!settings) return { ok: false, error: "Set a location first." };
    const res = await refreshWindows(createSupabaseAdminClient(), orgId, settings);
    revalidatePath("/settings");
    return res.ok ? { ok: true, message: `Times refreshed (${res.windows} periods).` } : { ok: false, error: res.error };
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: err.message };
    throw err;
  }
}
