/**
 * Offer letters. A school can keep its own letters as plain text with {tags}
 * ({candidate_name}, {monthly_salary}, {joining_date}, …), next to the
 * standard Edcruiter letter. When an offer is prepared, the tags are filled
 * from the teacher, the approved salary, the campus and the joining date; a
 * letter with a tag that cannot be filled is not sent.
 *
 * All pure, so the rules are tested without a page or a server.
 */

import { termLines } from './offerTerms';
import type { Candidate, OfferLetterDetails, OfferLetterTemplate, School, SentOfferLetter } from './types';

export const MAX_TEMPLATES = 20;
export const MAX_BODY = 20_000;
export const STANDARD_LETTER = 'Edcruiter standard letter';

/** The tags a template may use, with what each becomes. */
export const OFFER_TAGS: { tag: string; label: string }[] = [
  { tag: 'candidate_name', label: 'Teacher’s name' },
  { tag: 'designation', label: 'Designation' },
  { tag: 'subject', label: 'Subject' },
  { tag: 'grades', label: 'Grades' },
  { tag: 'campus', label: 'Campus' },
  { tag: 'monthly_salary', label: 'Monthly salary' },
  { tag: 'annual_ctc', label: 'Yearly CTC' },
  { tag: 'joining_date', label: 'Joining date' },
  { tag: 'school_name', label: 'School name' },
  { tag: 'signatory', label: 'Signed by' },
  { tag: 'date', label: 'Today’s date' },
];
const TAG_SET = new Set(OFFER_TAGS.map((t) => t.tag));

/** A plain starting letter for a school's first template. */
export const STARTER_TEMPLATE = `Dear {candidate_name},

We are pleased to offer you the position of {designation} at {school_name}, {campus}.

Your monthly salary will be {monthly_salary} ({annual_ctc} a year). Your joining date is {joining_date}.

Please sign and return a copy of this letter to accept the offer.

Warm regards,
{signatory}
{school_name}
{date}`;

const newId = () => `olt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The tags used in a body, and any that are not ones we know. */
export function tagsIn(body: string): { used: string[]; unknown: string[] } {
  const used = [...new Set([...body.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]))];
  return { used, unknown: used.filter((t) => !TAG_SET.has(t)) };
}

/** Checks the templates before they are saved. Returns them cleaned, or a plain-language reason. */
export function parseTemplates(input: unknown, by: string, nowIso = new Date().toISOString(), before: OfferLetterTemplate[] = []):
  { ok: true; templates: OfferLetterTemplate[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'The templates were not in the right form.' };
  if (input.length > MAX_TEMPLATES) return { ok: false, error: `A school can keep up to ${MAX_TEMPLATES} offer letters.` };
  const names = new Set<string>();
  const out: OfferLetterTemplate[] = [];
  for (const raw of input as Record<string, unknown>[]) {
    const name = typeof raw?.name === 'string' ? raw.name.replace(/\s+/g, ' ').trim() : '';
    if (name.length < 2 || name.length > 60) return { ok: false, error: 'Each letter needs a name of 2 to 60 characters.' };
    if (names.has(name.toLowerCase()) || name.toLowerCase() === STANDARD_LETTER.toLowerCase()) return { ok: false, error: `You have two letters called "${name}".` };
    names.add(name.toLowerCase());
    const body = typeof raw?.body === 'string' ? raw.body.replace(/\r\n/g, '\n').trim() : '';
    if (body.length < 20) return { ok: false, error: `${name}: write the letter (at least a few lines).` };
    if (body.length > MAX_BODY) return { ok: false, error: `${name}: the letter is too long.` };
    const { unknown } = tagsIn(body);
    if (unknown.length) return { ok: false, error: `${name}: {${unknown[0]}} is not a tag we can fill. Use the tag buttons to add one.` };
    const id = typeof raw?.id === 'string' && /^olt_[a-z0-9]{4,30}$/.test(raw.id) ? raw.id : newId();
    const old = before.find((t) => t.id === id);
    const changed = !old || old.name !== name || old.body !== body;
    out.push({ id, name, body, updated_at: changed ? nowIso : old!.updated_at, ...(changed ? { updated_by: by } : old!.updated_by ? { updated_by: old!.updated_by } : {}) });
  }
  return { ok: true, templates: out };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Today, or a joining date of the form 2026-12-01, as "1 December 2026". */
export function longDate(iso?: string): string {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Is this a whole joining date that makes sense: four-digit year, a real day,
 * not before today, and within the next 12 months. The date box only gives a
 * value once the date is whole, but "0002-05-01" counts as whole while the
 * year is still being typed, so the year is checked too.
 */
export function joiningDateProblem(iso: string, today = new Date()): string | null {
  if (!iso) return 'Choose the joining date.';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return 'Type the whole date: day, month and year.';
  if (Number(m[1]) < 2000) return 'Type the whole year, with four digits.';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return 'That date does not exist.';
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
  if (d < start) return 'The joining date cannot be in the past.';
  if (d > end) return 'The joining date must be within the next 12 months.';
  return null;
}

export interface OfferInputs {
  monthly: number;
  joining_iso: string;
  campus: string;
}

/** Everything a letter says, from the teacher, the school and the offer. */
export function letterDetails(candidate: Candidate, school: Pick<School, 'id' | 'name' | 'primary_contact' | 'branches'> | null, input: OfferInputs, todayIso?: string): OfferLetterDetails {
  const branch = school?.branches?.find((b) => b.name === input.campus);
  return {
    candidate_id: candidate.id,
    candidate_name: candidate.name,
    candidate_email: candidate.email,
    candidate_phone: candidate.phone,
    school_id: school?.id ?? candidate.school_id,
    school_name: school?.name ?? '',
    designation: candidate.final_offer?.role_name || `Teacher – ${candidate.applied_subject}`,
    subject: candidate.applied_subject,
    grade_segment: candidate.applied_segment,
    branch_name: input.campus,
    branch_location: branch?.location ?? '',
    annual_ctc: input.monthly > 0 ? inr(input.monthly * 12) : '',
    monthly_salary: input.monthly > 0 ? inr(input.monthly) : '',
    probation_period: '',
    notice_period: '',
    joining_date: input.joining_iso ? longDate(input.joining_iso) : '',
    reporting_authority: school?.primary_contact?.name ?? '',
    issue_date: longDate(todayIso),
    ...(candidate.offer_terms?.include_in_letter && termLines(candidate.offer_terms).length ? { terms: termLines(candidate.offer_terms) } : {}),
  };
}

/** Fills a template's tags. `missing` lists the tags that had nothing to fill them. */
export function fillTemplate(body: string, d: OfferLetterDetails): { text: string; missing: string[] } {
  const values: Record<string, string> = {
    candidate_name: d.candidate_name,
    designation: d.designation,
    subject: d.subject,
    grades: d.grade_segment,
    campus: d.branch_name,
    monthly_salary: d.monthly_salary,
    annual_ctc: d.annual_ctc,
    joining_date: d.joining_date,
    school_name: d.school_name,
    signatory: d.reporting_authority,
    date: d.issue_date,
  };
  const missing = new Set<string>();
  const text = body.replace(/\{([a-z_]+)\}/g, (all, tag: string) => {
    const v = values[tag];
    if (v === undefined) return all;
    if (!v.trim()) { missing.add(tag); return `[${OFFER_TAGS.find((t) => t.tag === tag)?.label ?? tag} missing]`; }
    return v;
  });
  // A school's own letter has no place for these, so they follow it.
  const extra = d.terms?.length ? ['', '', 'Agreed conditions:', ...d.terms.map((t) => `- ${t}`)].join(String.fromCharCode(10)) : '';
  return { text: text + extra, missing: [...missing] };
}

/**
 * The letter as it is sent, built on the server from the teacher and the
 * school, so what is stored is never just what a page claimed. Refused with a
 * plain reason when the salary, campus or date is not real, or a tag is empty.
 */
export function buildSentLetter(
  input: unknown,
  candidate: Candidate,
  school: Pick<School, 'id' | 'name' | 'primary_contact' | 'branches' | 'offer_letter_templates'> | null,
  by: string,
  now = new Date(),
): { ok: true; letter: SentOfferLetter } | { ok: false; error: string } {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const monthly = Math.round(Number(r.monthly));
  if (!Number.isFinite(monthly) || monthly < 1000 || monthly > 1_000_000) return { ok: false, error: 'Type the offered salary as rupees a month, numbers only (e.g. 35000).' };
  const joining = typeof r.joining_iso === 'string' ? r.joining_iso : '';
  const dateIssue = joiningDateProblem(joining, now);
  if (dateIssue) return { ok: false, error: dateIssue };
  const campus = typeof r.campus === 'string' ? r.campus.trim() : '';
  if (!campus || !school?.branches?.some((b) => b.name === campus)) return { ok: false, error: 'Choose the campus.' };
  if (!school?.name) return { ok: false, error: 'The school details could not be read. Reload the page and try again.' };
  const details = letterDetails(candidate, school, { monthly, joining_iso: joining, campus }, now.toISOString().slice(0, 10));
  const template = typeof r.template_id === 'string' && r.template_id ? school.offer_letter_templates?.find((t) => t.id === r.template_id) : undefined;
  if (typeof r.template_id === 'string' && r.template_id && !template) return { ok: false, error: 'That letter template was not found. It may have been deleted.' };
  if (!template) return { ok: true, letter: { template_name: STANDARD_LETTER, details, sent_at: now.toISOString(), sent_by: by } };
  const filled = fillTemplate(template.body, details);
  if (filled.missing.length) {
    return { ok: false, error: `The letter needs ${filled.missing.map((t) => OFFER_TAGS.find((x) => x.tag === t)?.label.toLowerCase() ?? t).join(', ')}, which is not set yet.` };
  }
  return { ok: true, letter: { template_id: template.id, template_name: template.name, details, text: filled.text, sent_at: now.toISOString(), sent_by: by } };
}
