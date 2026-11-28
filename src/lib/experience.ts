/**
 * Years of teaching experience, one choice per year so a school can tell 8 from
 * 13. Older records hold bands ("8+ Years"); they are kept as written and still
 * read by yearsOf in payGuide.ts, which takes the first number.
 */
export const MAX_EXPERIENCE_YEARS = 25;

export const EXPERIENCE_OPTIONS: string[] = [
  'Fresher',
  ...Array.from({ length: MAX_EXPERIENCE_YEARS }, (_, i) => (i === 0 ? '1 year' : `${i + 1} years`)),
  `More than ${MAX_EXPERIENCE_YEARS} years`,
];

/** The choices for a select, keeping an older saved value so it does not silently disappear. */
export function experienceChoices(current?: string): string[] {
  return current && !EXPERIENCE_OPTIONS.includes(current) ? [current, ...EXPERIENCE_OPTIONS] : EXPERIENCE_OPTIONS;
}
