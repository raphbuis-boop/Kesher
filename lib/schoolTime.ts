import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A school's wall clock. Scheduling is always entered and shown in the school's
 * own timezone (settings key `timezone`), never the browser's, and stored as UTC.
 * Pure helpers (no server-only imports) so the compose screen can use them too.
 */

export const DEFAULT_TIMEZONE = "America/New_York";

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Toronto", label: "Eastern (Toronto)" },
  { value: "America/Montreal", label: "Eastern (Montreal)" },
  { value: "America/Winnipeg", label: "Central (Winnipeg)" },
  { value: "America/Vancouver", label: "Pacific (Vancouver)" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Zurich", label: "Zurich" },
  { value: "Asia/Jerusalem", label: "Israel (Jerusalem)" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Australia/Melbourne", label: "Melbourne" },
  { value: "Australia/Sydney", label: "Sydney" },
];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Shabbos"] as const;
/** Plain weekday names (Saturday for the calendar day, even where the UI says Shabbos). */
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function getSchoolTimezone(supabase: SupabaseClient, orgId: string): Promise<string> {
  const { data } = await supabase.from("settings").select("value").eq("org_id", orgId).eq("key", "timezone").maybeSingle();
  const tz = (data?.value as string | undefined)?.trim();
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Whether members' sends need an admin's approval first (off by default). */
export async function getRequireApproval(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await supabase.from("settings").select("value").eq("org_id", orgId).eq("key", "require_approval").maybeSingle();
  return data?.value === "true";
}

// ─── Wall-clock math ──────────────────────────────────────────────────────────

export type ZonedParts = { y: number; mo: number; d: number; h: number; mi: number; s: number; weekday: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(at: Date, tz: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of formatterFor(tz).formatToParts(at)) out[p.type] = p.value;
  return {
    y: Number(out.year),
    mo: Number(out.month),
    d: Number(out.day),
    h: Number(out.hour) % 24,
    mi: Number(out.minute),
    s: Number(out.second),
    weekday: WEEKDAY_INDEX[out.weekday] ?? 0,
  };
}

function offsetMs(at: Date, tz: string): number {
  const p = zonedParts(at, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(at.getTime() / 1000) * 1000;
}

/** "2026-11-06" + "09:00" in `tz` → the UTC instant. A time skipped by daylight saving moves to just after the gap. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const o1 = offsetMs(new Date(wall), tz);
  const t1 = wall - o1;
  const o2 = offsetMs(new Date(t1), tz);
  if (o1 === o2) return new Date(t1);
  const t2 = wall - o2;
  // Near a clock change: use whichever guess lands on the requested wall time; a skipped time goes after the gap
  return new Date(offsetMs(new Date(t2), tz) === o2 ? t2 : Math.max(t1, t2));
}

export function isDateString(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export function isTimeString(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The school's local date (YYYY-MM-DD) at an instant. */
export function localDateString(at: Date, tz: string): string {
  const p = zonedParts(at, tz);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

export function localTimeString(at: Date, tz: string): string {
  const p = zonedParts(at, tz);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

/** Calendar-day arithmetic on YYYY-MM-DD strings (no timezone involved). */
export function addDays(date: string, days: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(date: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export function dayNumberOf(date: string): number {
  return dayNumber(date);
}

function dayNumber(date: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, mo - 1, d) / 86_400_000);
}

// ─── Display ──────────────────────────────────────────────────────────────────

/** "Thu, Nov 6, 9:00 AM EST" in the school's timezone. */
export function formatInZone(at: Date | string, tz: string, opts: { withZone?: boolean; withYear?: boolean } = {}): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(opts.withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    ...(opts.withZone === false ? {} : { timeZoneName: "short" }),
  }).format(d);
}

export function formatTimeOnly(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
}

// ─── Recurring rules ──────────────────────────────────────────────────────────

/**
 * "Every N weeks on <weekday> at <time>" in the school's timezone. `startDate`
 * is the first date the schedule counts from (which also fixes which weeks
 * count for every-2-weeks and so on). Zmanim-based rules (Phase 3.2) add a
 * second kind below.
 */
export type ClockRule = { kind: "clock"; everyWeeks: number; weekday: number; time: string; startDate: string };

export function validClockRule(rule: unknown): rule is ClockRule {
  if (!rule || typeof rule !== "object") return false;
  const r = rule as Record<string, unknown>;
  return (
    r.kind === "clock" &&
    Number.isInteger(r.everyWeeks) &&
    (r.everyWeeks as number) >= 1 &&
    (r.everyWeeks as number) <= 12 &&
    Number.isInteger(r.weekday) &&
    (r.weekday as number) >= 0 &&
    (r.weekday as number) <= 6 &&
    isTimeString(r.time) &&
    isDateString(r.startDate)
  );
}

/** First occurrence: the first `weekday` on or after startDate. */
function firstOccurrenceDate(rule: ClockRule): string {
  const delta = (rule.weekday - weekdayOf(rule.startDate) + 7) % 7;
  return addDays(rule.startDate, delta);
}

/** The next occurrence strictly after `after`, as a UTC instant. */
export function nextClockOccurrence(rule: ClockRule, tz: string, after: Date): Date {
  const first = firstOccurrenceDate(rule);
  const step = rule.everyWeeks * 7;
  const today = dayNumber(localDateString(after, tz));
  let k = Math.max(0, Math.floor((today - dayNumber(first)) / step) - 1);
  for (let guard = 0; guard < 400; guard++, k++) {
    const when = zonedToUtc(addDays(first, step * k), rule.time, tz);
    if (when.getTime() > after.getTime()) return when;
  }
  throw new Error("Could not work out the next send time.");
}

export function describeClockRule(rule: ClockRule): string {
  const every = rule.everyWeeks === 1 ? "Every week" : `Every ${rule.everyWeeks} weeks`;
  return `${every} on ${WEEKDAY_NAMES[rule.weekday]} at ${formatTimeOnly(rule.time)}`;
}
