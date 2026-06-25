/**
 * Graduation year display utilities.
 * All labels are computed from graduation_year — we never store a grade string.
 */

function currentAcademicEndYear(): number {
  // Academic year ends in June (month index 5).
  // Before June: the graduating class hasn't graduated yet, so baseYear = current year.
  // June or later: that class has graduated, so baseYear = current year (they're now alumni).
  // Either way the current calendar year is always the senior graduation year.
  const now = new Date();
  return now.getFullYear();
}

/**
 * Compute the current grade level from a graduation year.
 * Returns null for alumni (graduated) or future students beyond K-12.
 */
export function gradYearToGrade(
  year: number,
  baseYear = currentAcademicEndYear()
): number | null {
  const grade = 12 - (year - baseYear);
  if (grade < 1 || grade > 12) return null;
  return grade;
}

/**
 * Full label for a graduation year, e.g. "Graduating Class of 2028" or "Alumni, Class of 2015".
 */
export function gradYearLabel(
  year: number,
  baseYear = currentAcademicEndYear()
): string {
  if (year <= baseYear) return `Alumni, Class of ${year}`;
  return `Graduating Class of ${year}`;
}

/**
 * Short grade label, e.g. "Grade 8" or "Class of 2028" (if not currently in K-12).
 */
export function gradeLabel(
  year: number,
  baseYear = currentAcademicEndYear()
): string {
  const grade = gradYearToGrade(year, baseYear);
  if (grade === null) return `Class of ${year}`;
  return `Grade ${grade}`;
}

/**
 * Compute graduation year from a grade number.
 * Grade 12 graduates in baseYear, Grade 11 in baseYear+1, etc.
 */
export function gradeToGradYear(
  grade: number,
  baseYear = currentAcademicEndYear()
): number {
  return baseYear + (12 - grade);
}
