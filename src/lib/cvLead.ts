import { formatWhatsAppDisplay, toWhatsAppE164 } from './whatsapp';

/** What Gemini reads off a CV, before we trust any of it. */
export interface RawCvExtraction {
  is_cv?: boolean;
  full_name?: string;
  phone?: string;
  email?: string;
  best_subject?: string;
  grade_segment?: string;
  qualifications?: string;
  total_experience_years?: number | string | null;
  latest_school_or_employer?: string;
  city?: string;
  has_b_ed?: boolean;
  notes?: string;
}

/** A lead built from a CV, ready to show in the import preview. */
export interface CvLead {
  name: string;
  email: string;
  phone: string;
  subject: string;
  segment: string;
  qualification: string;
  experience: string;
  prior_org: string;
  source: string;
  /** Things the school should look at before importing this row. */
  warnings: string[];
}

export interface CvIntakeContext {
  subjects: string[];
  segments: string[];
}

const NOT_A_NAME = /^(curriculum vitae|resume|r[ée]sum[ée]|cv|bio-?data|profile|name|applicant|candidate)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function indianMobileOrNull(raw: string): { display: string; e164: string } | null {
  const e164 = toWhatsAppE164(raw);
  if (!e164) return null;
  if (e164.startsWith('91')) {
    const national = e164.slice(2);
    // Indian mobiles are 10 digits starting 6-9. Anything else read off a CV
    // is a landline, a pincode or an ID number.
    if (!/^[6-9]\d{9}$/.test(national)) return null;
  }
  return { display: formatWhatsAppDisplay(e164), e164 };
}

function pickClosest(value: string | undefined, options: string[], fallback: string): { value: string; matched: boolean } {
  const wanted = (value || '').trim().toLowerCase();
  if (!wanted) return { value: fallback, matched: false };
  const exact = options.find((o) => o.toLowerCase() === wanted);
  if (exact) return { value: exact, matched: true };
  const partial = options.find((o) => {
    const lo = o.toLowerCase();
    return lo.includes(wanted) || wanted.includes(lo);
  });
  if (partial) return { value: partial, matched: true };
  return { value: value!.trim(), matched: false };
}

function experienceLabel(years: RawCvExtraction['total_experience_years']): string {
  const n = typeof years === 'string' ? parseFloat(years) : years;
  if (n === null || n === undefined || Number.isNaN(n) || n < 0) return '';
  if (n === 0) return 'Fresher';
  return `${Math.round(n * 10) / 10} Years`;
}

/**
 * Turns the model's raw reading into a lead plus the warnings a person needs.
 * Nothing is invented: a field the CV did not contain stays empty, and the row
 * says so. Pure, so it is tested without calling the model.
 */
export function normalizeCvExtraction(raw: RawCvExtraction, filename: string, ctx: CvIntakeContext): CvLead {
  const warnings: string[] = [];

  const name = (raw.full_name || '').replace(/\s+/g, ' ').trim();
  const nameLooksWrong = !name || NOT_A_NAME.test(name) || name.length < 2 || /\d{4,}/.test(name);
  if (nameLooksWrong) warnings.push('Could not read the candidate\'s name — type it in.');

  if (raw.is_cv === false) warnings.push('This file does not look like a CV. Check it before importing.');

  const phone = indianMobileOrNull(raw.phone || '');
  if (!phone) {
    warnings.push(raw.phone
      ? `Phone "${raw.phone}" is not a valid mobile number — fix it or this teacher cannot get a WhatsApp invite.`
      : 'No phone number on the CV — this teacher cannot get a WhatsApp invite.');
  }

  const emailRaw = (raw.email || '').trim().toLowerCase();
  const email = EMAIL.test(emailRaw) ? emailRaw : '';
  if (emailRaw && !email) warnings.push(`Email "${raw.email}" does not look valid.`);

  const subject = pickClosest(raw.best_subject, ctx.subjects, 'General');
  if (!subject.matched) {
    warnings.push(subject.value === 'General'
      ? 'Could not tell which subject this teacher teaches — choose one.'
      : `Subject "${subject.value}" is not one of your school's subjects — check it.`);
  }

  const segment = pickClosest(raw.grade_segment, ctx.segments, ctx.segments[0] || 'Secondary (Grades 9-10)');
  if (raw.has_b_ed === false) warnings.push('No B.Ed / D.El.Ed found on the CV.');

  return {
    name: nameLooksWrong ? '' : name,
    email,
    phone: phone ? phone.display : '',
    subject: subject.value,
    segment: segment.value,
    qualification: (raw.qualifications || '').trim(),
    experience: experienceLabel(raw.total_experience_years),
    prior_org: (raw.latest_school_or_employer || '').trim(),
    source: filename,
    warnings
  };
}

/** Marks later rows that repeat an earlier row's phone or email. */
export function flagDuplicateLeads<T extends { phone: string; email: string; warnings: string[] }>(rows: T[]): T[] {
  const seen = new Map<string, number>();
  return rows.map((row, i) => {
    const keys = [row.phone && `p:${row.phone.replace(/\D/g, '')}`, row.email && `e:${row.email}`].filter(Boolean) as string[];
    const dupOf = keys.map((k) => seen.get(k)).find((v) => v !== undefined);
    keys.forEach((k) => { if (!seen.has(k)) seen.set(k, i); });
    return dupOf === undefined
      ? row
      : { ...row, warnings: [...row.warnings, `Same phone or email as row ${dupOf + 1} — probably a duplicate.`] };
  });
}

export function looksLikePdf(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}
