/** Split combined qualification strings into highest degree + B.Ed flag. */

const BED_RE = /\b(b\.?\s*ed|bed|d\.?\s*el\.?\s*ed|deled|ncte)\b/i;

const DEGREE_PRIORITY: { re: RegExp; label: string }[] = [
  { re: /\b(ph\.?d|doctorate)\b/i, label: 'Ph.D' },
  { re: /\b(m\.?\s*phil)\b/i, label: 'M.Phil' },
  { re: /\b(m\.?\s*ed|med)\b/i, label: 'M.Ed' },
  { re: /\b(m\.?\s*sc|msc|m\.?\s*a\.?|ma|m\.?\s*com|m\.?\s*tech)\b/i, label: 'Masters' },
  { re: /\b(b\.?\s*sc|bsc|b\.?\s*a\.?|ba|b\.?\s*com|b\.?\s*tech|b\.?\s*e\.?)\b/i, label: 'Bachelors' },
  { re: /\b(diploma)\b/i, label: 'Diploma' },
];

export function hasBEdCredential(text?: string | null, resumeBedStatus?: string | null): boolean {
  if (resumeBedStatus && /listed|completed|yes|hold|qualified|present/i.test(resumeBedStatus) && !/not\s*listed|missing|no\b/i.test(resumeBedStatus)) {
    return true;
  }
  return BED_RE.test(text || '');
}

export function highestDegreeLabel(text?: string | null, degreesFound?: string[]): string {
  const blob = [text || '', ...(degreesFound || [])].join(' ');
  for (const row of DEGREE_PRIORITY) {
    if (row.re.test(blob)) {
      // Prefer the more specific token from degreesFound when available
      const fromList = degreesFound?.find((d) => row.re.test(d));
      return fromList || row.label;
    }
  }
  const cleaned = (text || '')
    .replace(BED_RE, '')
    .replace(/[+,|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Not listed';
}

export function credentialsFromCandidate(c: {
  qualification?: string;
  resume_analysis?: {
    qualifications_match?: {
      degrees_found?: string[];
      b_ed_status?: string;
    };
  };
}): { highestDegree: string; hasBEd: boolean; bedLabel: 'Yes' | 'No' } {
  const degrees = c.resume_analysis?.qualifications_match?.degrees_found;
  const bedStatus = c.resume_analysis?.qualifications_match?.b_ed_status;
  const hasBEd = hasBEdCredential(c.qualification, bedStatus);
  return {
    highestDegree: highestDegreeLabel(c.qualification, degrees),
    hasBEd,
    bedLabel: hasBEd ? 'Yes' : 'No',
  };
}
