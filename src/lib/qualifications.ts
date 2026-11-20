/**
 * The "highest qualification" choices a teacher picks from when applying. One
 * list, used by the apply page and the candidate's own profile, so a computer
 * science teacher with a B.Tech or an MCA finds their degree as easily as a
 * B.Sc or B.A holder does. The first entry of the bachelor's and master's
 * groups and the teaching and doctorate entries keep the wording older
 * applications were saved with.
 */

export interface QualificationGroup {
  label: string;
  options: string[];
}

export const QUALIFICATION_GROUPS: QualificationGroup[] = [
  {
    label: "Bachelor's degree (graduation)",
    options: [
      'Graduation (B.Sc / B.A / B.Com)',
      'B.Tech / B.E (Engineering)',
      'BCA / BBA',
      'B.Arch (Architecture)',
      'B.Pharm (Pharmacy)',
      'B.Des / BFA (Design, Fine Arts)',
      'LLB (Law)',
    ],
  },
  {
    label: 'Teaching qualification',
    options: [
      'B.Ed (Bachelor of Education)',
      'B.El.Ed (Elementary Education)',
      'B.P.Ed (Physical Education)',
      'D.El.Ed / NTT / Montessori Diploma',
    ],
  },
  {
    label: "Master's degree (post graduation)",
    options: [
      'Masters / Post Graduation (M.Sc / M.A / M.Ed)',
      'M.Tech / M.E (Engineering)',
      'MCA / MBA',
      'M.Ed (Master of Education)',
      'M.Phil',
      'M.Arch / M.Pharm',
      'M.P.Ed (Physical Education)',
      'LLM (Law)',
    ],
  },
  {
    label: 'Doctorate',
    options: ['Ph.D / Doctorate'],
  },
  {
    label: 'Diploma or school certificate',
    options: ['Diploma (Polytechnic / ITI)', 'Class 12 / Intermediate'],
  },
];

/** Every listed choice, in order. */
export const QUALIFICATION_OPTIONS: string[] = QUALIFICATION_GROUPS.flatMap((g) => g.options);

/** The choice that lets a candidate type their own. */
export const OTHER_QUALIFICATION = 'Others';

/** Whether a stored qualification is one of the listed choices (anything else is shown as typed text). */
export function isListedQualification(value: string | undefined): boolean {
  return !!value && QUALIFICATION_OPTIONS.includes(value);
}
