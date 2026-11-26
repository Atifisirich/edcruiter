/**
 * Reading a sheet of candidates for bulk import. Finding the columns is the
 * same job as for leads (leadSheet.ts: names and phones by what is in the
 * cells, with or without headings). On top of that, a candidate needs a subject,
 * which schools often write as the post ("Pre primary teacher", "Counsellor"),
 * Pure, so it is tested without a browser.
 */
import { isJobTitle, leadRowsFrom, phoneIn, readSheet, type LeadField, type SheetColumn, type SheetRead } from './leadSheet';
import { segmentFromGrades } from './grades';

export const MAX_CANDIDATE_ROWS = 200;
const DEFAULT_SEGMENT = 'Secondary (Grades 9-10)';

export interface SheetCandidate {
  name: string;
  email: string;
  phone: string;
  subject: string;
  segment: string;
  qualification: string;
  experience: string;
  prior_org: string;
  warnings?: string[];
}

/** The columns HR can choose on the screen. */
export const CHOOSABLE_FIELDS: { field: LeadField; label: string }[] = [
  { field: 'name', label: 'Name' },
  { field: 'phone', label: 'Phone' },
  { field: 'subject', label: 'Subject or post' },
  { field: 'email', label: 'Email' },
  { field: 'segment', label: 'Grades' },
];

const SUBJECT_HEADER = /\b(subject|position|post|designation|applied for|applying for|role|vacancy|job|department|discipline)\b/i;
const SUBJECT_NAME = /\b(math(s|ematics)?|english|hindi|telugu|urdu|sanskrit|science|physics|chemistry|biology|social( studies)?|history|geography|computers?|economics|commerce|accounts|evs|music|dance|art|physical education|sports|yoga)\b/i;
const PAY_HEADER = /salary|ctc|\bpay\b/i;

export interface CandidateSheet {
  read: SheetRead;
  mapping: Partial<Record<LeadField, number>>;
}

/** A column nobody has claimed whose heading or contents say it is the post or subject. */
function findSubjectColumn(read: SheetRead, used: Set<number>): number | undefined {
  const free = read.columns.filter((c) => !used.has(c.index) && !PAY_HEADER.test(c.header));
  const byHeading = read.headerRow === null ? undefined : free.find((c) => SUBJECT_HEADER.test(c.header) && !c.header.includes('?'));
  if (byHeading) return byHeading.index;
  const mostly = (c: SheetColumn) => {
    const vals = read.rows.slice(0, 100).map((r) => r[c.index] ?? '').filter(Boolean);
    return vals.length > 0 && vals.filter((v) => isJobTitle(v) || SUBJECT_NAME.test(v)).length / vals.length >= 0.5;
  };
  return free.find(mostly)?.index;
}

export function readCandidateSheet(matrix: unknown[][]): CandidateSheet {
  const read = readSheet(matrix);
  const mapping = { ...read.mapping };
  const used = new Set(Object.values(mapping).filter((v): v is number => typeof v === 'number'));
  if (mapping.subject === undefined) {
    const i = findSubjectColumn(read, used);
    if (i !== undefined) mapping.subject = i;
  }
  return { read, mapping };
}

/** "Pre primary teacher" means nursery to UKG, not the usual Grades 9-10. */
function segmentFor(segment: string, subject: string): string {
  if (segment) return segment;
  if (/pre[\s-]?primary|nursery|\b[lu]kg\b|kindergarten|montessori/i.test(subject)) return segmentFromGrades(['nursery', 'lkg', 'ukg']);
  return DEFAULT_SEGMENT;
}

/** The candidates, using the columns on the screen. */
export function candidatesFrom(sheet: CandidateSheet, mapping: Partial<Record<LeadField, number>> = sheet.mapping): SheetCandidate[] {
  const rows = leadRowsFrom(sheet.read, mapping);
  const out: SheetCandidate[] = [];
  rows.forEach((r) => {
    if (!r.name && !r.phone && !r.email) return;
    const subject = r.subject || 'General';
    out.push({
      name: r.name,
      email: r.email,
      phone: r.phone,
      subject,
      segment: segmentFor(r.segment, r.subject),
      qualification: r.qualification,
      experience: r.experience,
      prior_org: r.prior_org,
    });
  });
  return out.slice(0, MAX_CANDIDATE_ROWS);
}

/** Why a row cannot be imported yet, or null when it can. A lead needs a name and a real way to reach them. */
export function rowProblem(r: Pick<SheetCandidate, 'name' | 'phone' | 'email'>): string | null {
  const phone = r.phone.trim();
  if (!r.name.trim()) return 'Needs a name.';
  if (phone && !phoneIn(phone)) return `"${phone}" is not a phone number. Correct it or clear it.`;
  if (!phone && !r.email.trim()) return 'Needs a phone or email.';
  return null;
}
