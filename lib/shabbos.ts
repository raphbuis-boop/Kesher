import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchWindows, type HebcalConfig } from "@/lib/hebcal";
import { formatInZone, getSchoolTimezone, zonedParts } from "@/lib/schoolTime";

/**
 * Shabbos & Yom Tov mode. Each school sets a location and its candle-lighting /
 * havdalah rules once; the windows come from Hebcal, are cached in
 * shabbos_windows (refreshed weekly by the dispatcher), and every send asks
 * sendWindowStatus() — one place, no network call on the hot path.
 */

export type ShabbosSettings = {
  enabled: boolean;
  geoKind: "zip" | "geoname";
  zip: string | null;
  geonameid: string | null;
  israelSchedule: boolean;
  locationName: string | null;
  tzid: string | null;
  candleMinutes: number;
  havdalahMode: "minutes" | "tzeis";
  havdalahMinutes: number;
  bufferMinutes: number;
  fetchedAt: string | null;
  fetchError: string | null;
};

export const SHABBOS_DEFAULTS = { candleMinutes: 18, havdalahMode: "minutes" as const, havdalahMinutes: 50, bufferMinutes: 30 };

type Row = {
  enabled: boolean;
  geo_kind: "zip" | "geoname";
  zip: string | null;
  geonameid: string | null;
  israel_schedule: boolean;
  location_name: string | null;
  tzid: string | null;
  candle_minutes: number;
  havdalah_mode: "minutes" | "tzeis";
  havdalah_minutes: number;
  buffer_minutes: number;
  fetched_at: string | null;
  fetch_error: string | null;
};

const COLUMNS = "enabled, geo_kind, zip, geonameid, israel_schedule, location_name, tzid, candle_minutes, havdalah_mode, havdalah_minutes, buffer_minutes, fetched_at, fetch_error";

export async function getShabbosSettings(supabase: SupabaseClient, orgId: string): Promise<ShabbosSettings | null> {
  const { data } = await supabase.from("org_shabbos").select(COLUMNS).eq("org_id", orgId).maybeSingle();
  const r = data as Row | null;
  if (!r) return null;
  return {
    enabled: r.enabled,
    geoKind: r.geo_kind,
    zip: r.zip,
    geonameid: r.geonameid,
    israelSchedule: r.israel_schedule,
    locationName: r.location_name,
    tzid: r.tzid,
    candleMinutes: r.candle_minutes,
    havdalahMode: r.havdalah_mode,
    havdalahMinutes: r.havdalah_minutes,
    bufferMinutes: r.buffer_minutes,
    fetchedAt: r.fetched_at,
    fetchError: r.fetch_error,
  };
}

export function hebcalConfig(s: ShabbosSettings): HebcalConfig {
  return {
    geoKind: s.geoKind,
    zip: s.zip,
    geonameid: s.geonameid,
    israelSchedule: s.israelSchedule,
    candleMinutes: s.candleMinutes,
    havdalahMode: s.havdalahMode,
    havdalahMinutes: s.havdalahMinutes,
  };
}

export type ShabbosWindow = { startsAt: string; endsAt: string; kind: "shabbos" | "yomtov"; label: string | null };

type WindowRow = { starts_at: string; ends_at: string; kind: "shabbos" | "yomtov"; label: string | null };
const toWindow = (r: WindowRow): ShabbosWindow => ({ startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), kind: r.kind, label: r.label });

/**
 * Fetches the school's windows from Hebcal and replaces the cached ones. Needs
 * the service role (shabbos_windows has no write policy for users). Safe to run
 * repeatedly; windows that already ended are kept for the log.
 */
export async function refreshWindows(admin: SupabaseClient, orgId: string, settings: ShabbosSettings, now: Date = new Date()): Promise<{ ok: true; windows: number } | { ok: false; error: string }> {
  try {
    const { windows, location } = await fetchWindows(hebcalConfig(settings), now);
    const fetchedAt = new Date().toISOString();
    const rows = windows.map((w) => ({ org_id: orgId, starts_at: w.startsAt.toISOString(), ends_at: w.endsAt.toISOString(), kind: w.kind, label: w.label, fetched_at: fetchedAt }));
    const { error } = await admin.from("shabbos_windows").upsert(rows, { onConflict: "org_id,starts_at" });
    if (error) throw new Error(error.message);
    // Drop upcoming windows that no longer exist (changed rules or location)
    await admin.from("shabbos_windows").delete().eq("org_id", orgId).gte("ends_at", now.toISOString()).lt("fetched_at", fetchedAt);
    await admin
      .from("org_shabbos")
      .update({
        fetched_at: fetchedAt,
        fetch_error: null,
        ...(location.title ? { location_name: location.title } : {}),
        ...(location.tzid ? { tzid: location.tzid } : {}),
        ...(location.latitude !== null ? { latitude: location.latitude } : {}),
        ...(location.longitude !== null ? { longitude: location.longitude } : {}),
      })
      .eq("org_id", orgId);
    return { ok: true, windows: rows.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Couldn't reach Hebcal.";
    await admin.from("org_shabbos").update({ fetch_error: error.slice(0, 300) }).eq("org_id", orgId);
    return { ok: false, error };
  }
}

const REFRESH_AFTER_MS = 6 * 86_400_000;
const MIN_COVERAGE_MS = 14 * 86_400_000;

/** Dispatcher: refresh schools whose cached windows are older than a week or run out within two weeks. */
export async function refreshStaleSchools(admin: SupabaseClient, now: Date = new Date(), limit = 5): Promise<number> {
  const { data } = await admin.from("org_shabbos").select(`org_id, ${COLUMNS}`).eq("enabled", true);
  let done = 0;
  for (const r of (data ?? []) as (Row & { org_id: string })[]) {
    if (done >= limit) break;
    const stale = !r.fetched_at || now.getTime() - new Date(r.fetched_at).getTime() > REFRESH_AFTER_MS;
    let short = false;
    if (!stale) {
      const { data: far } = await admin.from("shabbos_windows").select("ends_at").eq("org_id", r.org_id).gte("ends_at", new Date(now.getTime() + MIN_COVERAGE_MS).toISOString()).limit(1);
      short = !far?.length;
    }
    // Retry failures at most every few hours so a Hebcal outage isn't hammered
    const recentFailure = !!r.fetch_error && !!r.fetched_at && now.getTime() - new Date(r.fetched_at).getTime() < 3 * 3_600_000;
    if ((stale || short) && !(recentFailure && !stale && !short)) {
      const settings = await getShabbosSettings(admin, r.org_id);
      if (settings) {
        await refreshWindows(admin, r.org_id, settings, now);
        done++;
      }
    }
  }
  return done;
}

/** Windows (current and upcoming) for display and for zmanim-relative scheduling. */
export async function getUpcomingWindows(supabase: SupabaseClient, orgId: string, from: Date = new Date(), limit = 6): Promise<ShabbosWindow[]> {
  const { data } = await supabase
    .from("shabbos_windows")
    .select("starts_at, ends_at, kind, label")
    .eq("org_id", orgId)
    .gte("ends_at", from.toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  return ((data ?? []) as WindowRow[]).map(toWindow);
}

// ─── The question every send asks ─────────────────────────────────────────────

export type WindowStatus =
  | { blocked: false }
  | { blocked: true; message: string; until: string | null; label: string | null; /** No Hebcal data: guessed from the day of the week */ approximate?: boolean };

const attempts = new Map<string, number>();

/**
 * Is `at` inside a Shabbos / Yom Tov window (plus the buffer after havdalah)?
 * Off unless the school turned it on. With no cached times and Hebcal
 * unreachable it errs on the side of not sending on Friday afternoon and
 * Shabbos — the only days where a wrong answer matters.
 */
export async function windowStatusFor(supabase: SupabaseClient, orgId: string, at: Date = new Date()): Promise<WindowStatus> {
  const settings = await getShabbosSettings(supabase, orgId);
  if (!settings?.enabled) return { blocked: false };
  const tz = await getSchoolTimezone(supabase, orgId);
  const buffer = settings.bufferMinutes * 60_000;

  const load = async () => {
    const { data: hit } = await supabase
      .from("shabbos_windows")
      .select("starts_at, ends_at, kind, label")
      .eq("org_id", orgId)
      .lte("starts_at", at.toISOString())
      .gte("ends_at", new Date(at.getTime() - buffer).toISOString())
      .order("ends_at", { ascending: false })
      .limit(1);
    const { data: ahead } = await supabase.from("shabbos_windows").select("ends_at").eq("org_id", orgId).gte("ends_at", at.toISOString()).limit(1);
    return { hit: ((hit ?? []) as WindowRow[])[0] as WindowRow | undefined, covered: !!ahead?.length || !!(hit ?? []).length };
  };

  let { hit, covered } = await load();
  if (!covered && !hit) {
    // Nothing cached for this time: try to fetch (at most once every 5 minutes per server)
    const last = attempts.get(orgId) ?? 0;
    if (Date.now() - last > 5 * 60_000) {
      attempts.set(orgId, Date.now());
      try {
        await refreshWindows(createSupabaseAdminClient(), orgId, settings, at);
        ({ hit, covered } = await load());
      } catch {
        // fall through to the day-of-week guess
      }
    }
  }

  if (hit) {
    const until = new Date(new Date(hit.ends_at).getTime() + buffer);
    const name = hit.kind === "yomtov" ? (hit.label ? hit.label : "Yom Tov") : "Shabbos";
    return {
      blocked: true,
      message: `It's ${name}. Messages are paused until ${formatInZone(until, tz)}${settings.bufferMinutes ? ` (${settings.bufferMinutes} minutes after Havdalah)` : ""}, so nothing reaches families during ${hit.kind === "yomtov" ? "Yom Tov" : "Shabbos"}. Scheduled messages go out automatically afterwards.`,
      until: until.toISOString(),
      label: hit.label,
    };
  }

  if (!covered) {
    const p = zonedParts(at, tz);
    if (p.weekday === 6 || (p.weekday === 5 && p.h >= 12)) {
      return {
        blocked: true,
        approximate: true,
        message: "Kesher can't load this week's Shabbos times from Hebcal right now, so messages are paused from Friday afternoon through Saturday to be safe. Try again shortly, or check Settings → Shabbos & Yom Tov.",
        until: null,
        label: null,
      };
    }
  }
  return { blocked: false };
}

/** Which window (if any) is happening at `at`, and which one starts next. */
export function currentAndNext(windows: ShabbosWindow[], bufferMinutes: number, at: Date = new Date()): { current: ShabbosWindow | null; next: ShabbosWindow | null } {
  const t = at.getTime();
  return {
    current: windows.find((w) => new Date(w.startsAt).getTime() <= t && new Date(w.endsAt).getTime() + bufferMinutes * 60_000 >= t) ?? null,
    next: windows.find((w) => new Date(w.startsAt).getTime() > t) ?? null,
  };
}
