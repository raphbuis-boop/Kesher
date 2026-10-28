/**
 * Hebcal REST API client (https://www.hebcal.com/home/195/jewish-calendar-rest-api).
 * Jewish calendar data © Hebcal.com, licensed CC BY 4.0, attributed in Settings.
 *
 * We ask for the whole calendar year (candle lighting, havdalah, major
 * holidays) for this year and next, pair candle lighting with havdalah into
 * windows, and cache those per school. Parsing is defensive: anything it
 * doesn't understand is skipped rather than guessed at.
 */

export const HEBCAL_ATTRIBUTION = "Jewish calendar data from Hebcal.com, licensed CC BY 4.0";
export const HEBCAL_URL = "https://www.hebcal.com";

export type HebcalConfig = {
  geoKind: "zip" | "geoname";
  zip: string | null;
  geonameid: string | null;
  israelSchedule: boolean;
  candleMinutes: number;
  havdalahMode: "minutes" | "tzeis";
  havdalahMinutes: number;
};

export type HebcalLocation = { title: string | null; tzid: string | null; latitude: number | null; longitude: number | null };

export type RawWindow = { startsAt: Date; endsAt: Date; kind: "shabbos" | "yomtov"; label: string };

/** "11230" → zip; a bare number like 281184 → Hebcal location (GeoNames) id. */
export function parseLocationInput(input: string): { geoKind: "zip"; zip: string } | { geoKind: "geoname"; geonameid: string } | null {
  const s = input.trim();
  if (/^\d{5}$/.test(s)) return { geoKind: "zip", zip: s };
  const m = s.match(/^(?:geonameid[=:\s-]*)?(\d{4,9})$/i);
  return m ? { geoKind: "geoname", geonameid: m[1] } : null;
}

export function buildHebcalUrl(cfg: HebcalConfig, year: number): string {
  const p = new URLSearchParams({
    v: "1",
    cfg: "json",
    maj: "on",
    min: "off",
    mod: "off",
    nx: "off",
    mf: "off",
    ss: "off",
    s: "off",
    c: "on",
    b: String(cfg.candleMinutes),
    year: String(year),
    month: "x",
    i: cfg.israelSchedule ? "on" : "off",
  });
  if (cfg.havdalahMode === "tzeis") p.set("M", "on");
  else {
    p.set("M", "off");
    p.set("m", String(cfg.havdalahMinutes));
  }
  if (cfg.geoKind === "zip") {
    p.set("geo", "zip");
    p.set("zip", cfg.zip ?? "");
  } else {
    p.set("geo", "geoname");
    p.set("geonameid", cfg.geonameid ?? "");
  }
  return `${HEBCAL_URL}/hebcal?${p}`;
}

type Item = { title?: string; date?: string; category?: string; yomtov?: boolean; memo?: string };

export function parseLocation(json: unknown): HebcalLocation {
  const loc = (json as { location?: Record<string, unknown> } | null)?.location ?? {};
  const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    title: typeof loc.title === "string" ? loc.title : typeof loc.city === "string" ? loc.city : null,
    tzid: typeof loc.tzid === "string" ? loc.tzid : null,
    latitude: num(loc.latitude),
    longitude: num(loc.longitude),
  };
}

/**
 * Pairs candle lighting with the next havdalah. A second candle lighting before
 * havdalah (two-day Yom Tov, or Yom Tov running into Shabbos) stays inside the
 * same window, so the whole stretch is one continuous block.
 */
export function windowsFromItems(items: Item[]): RawWindow[] {
  const timed = items
    .filter((i) => (i.category === "candles" || i.category === "havdalah") && typeof i.date === "string" && i.date.length > 10)
    .map((i) => ({ category: i.category as "candles" | "havdalah", at: new Date(i.date as string), memo: i.memo ?? "" }))
    .filter((i) => !Number.isNaN(i.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const holidays = items
    .filter((i) => i.category === "holiday" && i.yomtov && typeof i.date === "string")
    .map((i) => ({ day: (i.date as string).slice(0, 10), title: String(i.title ?? "Yom Tov") }));

  const out: RawWindow[] = [];
  let open: { at: Date; memo: string } | null = null;
  for (const e of timed) {
    if (e.category === "candles") {
      if (!open) open = { at: e.at, memo: e.memo };
    } else if (open) {
      if (e.at.getTime() > open.at.getTime()) {
        const startDay = open.at.toISOString().slice(0, 10);
        const endDay = e.at.toISOString().slice(0, 10);
        // Yom Tov days fall on or after the candle-lighting date (UTC dates are close enough to match by day ±1)
        const yomtov = holidays.filter((h) => h.day >= shiftDay(startDay, -1) && h.day <= shiftDay(endDay, 1));
        out.push({
          startsAt: open.at,
          endsAt: e.at,
          kind: yomtov.length > 0 ? "yomtov" : "shabbos",
          label: yomtov.length > 0 ? yomtov.map((h) => h.title).filter((t, i, a) => a.indexOf(t) === i).slice(0, 2).join(" · ") : open.memo.replace(/^Parashat\s+/, "Parshas ") || "Shabbos",
        });
      }
      open = null;
    }
  }
  return out;
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export type FetchedCalendar = { windows: RawWindow[]; location: HebcalLocation };

/** Fetches this year and next, merges, and returns the windows that haven't ended yet. */
export async function fetchWindows(cfg: HebcalConfig, now: Date = new Date(), fetchImpl: typeof fetch = fetch): Promise<FetchedCalendar> {
  const year = now.getUTCFullYear();
  const items: Item[] = [];
  let location: HebcalLocation = { title: null, tzid: null, latitude: null, longitude: null };
  for (const y of [year, year + 1]) {
    const res = await fetchImpl(buildHebcalUrl(cfg, y), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { error?: string }).error ?? "";
      } catch {
        // not JSON
      }
      throw new Error(detail ? `Hebcal: ${detail}` : `Hebcal returned HTTP ${res.status}`);
    }
    const json = (await res.json()) as { items?: Item[]; error?: string };
    if (json.error) throw new Error(`Hebcal: ${json.error}`);
    if (y === year) location = parseLocation(json);
    items.push(...(json.items ?? []));
  }
  const windows = windowsFromItems(items).filter((w) => w.endsAt.getTime() > now.getTime() - 86_400_000);
  if (windows.length === 0) throw new Error("Hebcal returned no candle-lighting times for that location.");
  return { windows, location };
}
