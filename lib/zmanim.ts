import { dayNumberOf, localDateString } from "@/lib/schoolTime";
import type { ShabbosWindow } from "@/lib/shabbos";

/**
 * Schedules tied to the Jewish calendar instead of the clock:
 *   "3 hours before candle lighting"      (Friday, every week or one time)
 *   "30 minutes after Havdalah"           (Motzei Shabbos)
 * Times come from the school's cached Hebcal windows (Settings → Shabbos & Yom Tov),
 * so they move with the seasons by themselves.
 */

export type ZmanimAnchor = "candle_lighting" | "havdalah";

/** offsetMinutes < 0 is before the anchor, > 0 after. Repeats on regular Shabbosim (weeks with Yom Tov are skipped). */
export type ZmanimRule = { kind: "zmanim"; anchor: ZmanimAnchor; offsetMinutes: number; everyWeeks: number; startDate: string };

export const MAX_OFFSET_MINUTES = 72 * 60;

export function validZmanimRule(rule: unknown): rule is ZmanimRule {
  if (!rule || typeof rule !== "object") return false;
  const r = rule as Record<string, unknown>;
  return (
    r.kind === "zmanim" &&
    (r.anchor === "candle_lighting" || r.anchor === "havdalah") &&
    Number.isInteger(r.offsetMinutes) &&
    Math.abs(r.offsetMinutes as number) <= MAX_OFFSET_MINUTES &&
    Number.isInteger(r.everyWeeks) &&
    (r.everyWeeks as number) >= 1 &&
    (r.everyWeeks as number) <= 12 &&
    typeof r.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.startDate)
  );
}

/** The instant a message tied to this window should go out. */
export function zmanimTime(window: Pick<ShabbosWindow, "startsAt" | "endsAt">, anchor: ZmanimAnchor, offsetMinutes: number): Date {
  const base = new Date(anchor === "candle_lighting" ? window.startsAt : window.endsAt);
  return new Date(base.getTime() + offsetMinutes * 60_000);
}

/** The next time a repeating zmanim rule fires after `after`, from the cached windows. Null if the cache doesn't reach that far. */
export function nextZmanimOccurrence(rule: ZmanimRule, windows: ShabbosWindow[], tz: string, after: Date): Date | null {
  const startDay = dayNumberOf(rule.startDate);
  const sorted = [...windows].filter((w) => w.kind === "shabbos").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const w of sorted) {
    const day = localDateString(new Date(w.startsAt), tz);
    if (day < rule.startDate) continue;
    const weekIndex = Math.floor((dayNumberOf(day) - startDay) / 7);
    if (weekIndex % rule.everyWeeks !== 0) continue;
    const at = zmanimTime(w, rule.anchor, rule.offsetMinutes);
    if (at.getTime() > after.getTime()) return at;
  }
  return null;
}

export function describeOffset(anchor: ZmanimAnchor, offsetMinutes: number): string {
  const name = anchor === "candle_lighting" ? "candle lighting" : "Havdalah (Motzei Shabbos)";
  if (offsetMinutes === 0) return `at ${name}`;
  const abs = Math.abs(offsetMinutes);
  const amount = abs % 60 === 0 ? `${abs / 60} hour${abs === 60 ? "" : "s"}` : `${abs} minute${abs === 1 ? "" : "s"}`;
  return `${amount} ${offsetMinutes < 0 ? "before" : "after"} ${name}`;
}

export function describeZmanimRule(rule: ZmanimRule): string {
  return `${rule.everyWeeks === 1 ? "Every Shabbos" : `Every ${rule.everyWeeks} weeks`}, ${describeOffset(rule.anchor, rule.offsetMinutes)}`;
}

