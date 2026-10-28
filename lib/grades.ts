/**
 * Grade helpers shared by smart audiences and the year-end rollover.
 * Grades are stored as text exactly as the school writes them ("Pre-K", "K",
 * "1"…"12"); rank gives them an order.
 */

export const GRADE_ORDER = ["Pre-K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

/** Pre-K = -1, K = 0, 1…12 = themselves; null for anything unrecognized ("Shiur Alef"). */
export function gradeRank(grade: string | null | undefined): number | null {
  const g = (grade ?? "").trim().toLowerCase();
  if (!g) return null;
  if (/^(pre-?k|pk|nursery)$/.test(g)) return -1;
  if (/^(k|kg|kindergarten)$/.test(g)) return 0;
  const m = g.match(/^(?:grade\s*)?(\d{1,2})(?:st|nd|rd|th)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

export function gradeFromRank(rank: number): string {
  if (rank <= -1) return "Pre-K";
  if (rank === 0) return "K";
  return String(rank);
}

/** The grade after this one, "graduated" past the top, or null when we can't tell. */
export function nextGrade(grade: string | null | undefined, topRank = 12): string | "graduated" | null {
  const r = gradeRank(grade);
  if (r === null) return null;
  return r >= topRank ? "graduated" : gradeFromRank(r + 1);
}

export function sameGrade(a: string | null | undefined, b: string | null | undefined): boolean {
  const ra = gradeRank(a);
  const rb = gradeRank(b);
  if (ra !== null && rb !== null) return ra === rb;
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}
