/**
 * A candidate's age, worked out from their date of birth. It is never typed in
 * and never stored from the browser: the page shows it as the date changes, and
 * the server works it out again when the details are saved.
 */

export const MIN_APPLICANT_AGE = 18;
export const MAX_APPLICANT_AGE = 70;

/** Whole years between `dob` (YYYY-MM-DD) and `today`, or null when the date is missing, invalid or in the future. */
export function ageFromDob(dob: string | undefined | null, today: Date = new Date()): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const born = new Date(Date.UTC(y, m - 1, d));
  // new Date rolls 31 February over to March, so check the date round-trips.
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== m - 1 || born.getUTCDate() !== d) return null;

  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/** A message the candidate can act on, or null when the date of birth is acceptable. */
export function dobProblem(dob: string | undefined | null, today: Date = new Date()): string | null {
  if (!dob) return 'Please enter your date of birth.';
  const age = ageFromDob(dob, today);
  if (age === null) return 'That date of birth does not look right. Please check it.';
  if (age < MIN_APPLICANT_AGE) return `You must be at least ${MIN_APPLICANT_AGE} years old to apply. Please check your date of birth.`;
  if (age > MAX_APPLICANT_AGE) return 'That date of birth does not look right. Please check it.';
  return null;
}
