/**
 * Salaries are rupees a month, typed as digits only. A teacher's current and
 * expected salary are stored as numbers (`current_salary_monthly`,
 * `expected_salary_monthly`); the older text fields stay filled with the same
 * figure written out ("₹35,000 / month"), so the AI call, the AI interview and
 * older screens keep reading them. Records from before this only have text,
 * which is still read (see `salaryOf`) and labelled as such.
 *
 * All pure, so the rules are tested without a page or a server.
 */

import { parseMonthly } from './payGuide';
import type { Candidate } from './types';

export const SALARY_HINT = 'Your monthly salary in rupees, numbers only (e.g. 35000)';
export const SALARY_MIN = 1_000;
export const SALARY_MAX = 1_000_000;
/** What the text field says for someone who is not working now. */
export const NOT_WORKING_TEXT = 'Not working now';

/** Keeps only the digits of what was typed, so a box can never hold anything else. */
export function digitsOnly(text: string): string {
  return String(text ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** "₹35,000 / month". */
export function formatMonthly(n: number): string {
  return `${inr(n)} / month`;
}

/**
 * One salary as typed: a whole number of rupees a month, or blank. Commas,
 * spaces and a ₹ sign are allowed around the digits; anything else ("5 LPA",
 * "35k", "negotiable") is refused with the hint.
 */
export function readSalaryInput(value: unknown, label: string): { ok: true; monthly: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') return { ok: true, monthly: null };
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.replace(/[\s,₹]/g, '') : '';
  if (!/^\d+$/.test(text)) return { ok: false, error: `${label}: ${SALARY_HINT.charAt(0).toLowerCase()}${SALARY_HINT.slice(1)}.` };
  const n = Number(text);
  if (n < SALARY_MIN || n > SALARY_MAX) {
    return { ok: false, error: `${label} must be between ${inr(SALARY_MIN)} and ${inr(SALARY_MAX)} a month. Type the monthly figure, not the yearly one.` };
  }
  return { ok: true, monthly: n };
}

type SalaryFields = Pick<Candidate, 'current_salary' | 'expected_salary' | 'current_salary_monthly' | 'expected_salary_monthly'>;

/**
 * Checks the salary part of a candidate write and fills both forms of each
 * figure. `*_monthly` wins; plain text is taken only when it is digits.
 * With `lenient` (a spreadsheet import), other text such as "5 LPA" is
 * converted instead of refused, and the original kept for the record.
 * `current_salary_monthly: 0` means "not working now".
 */
export function salaryUpdates(
  input: Record<string, unknown>,
  opts: { lenient?: boolean } = {},
): { ok: true; updates: Partial<SalaryFields>; notes: string[] } | { ok: false; error: string } {
  const updates: Partial<SalaryFields> = {};
  const notes: string[] = [];
  for (const which of ['current', 'expected'] as const) {
    const label = which === 'current' ? 'Current salary' : 'Expected salary';
    const numKey = `${which}_salary_monthly` as const;
    const textKey = `${which}_salary` as const;
    const hasNum = Object.prototype.hasOwnProperty.call(input, numKey);
    const hasText = Object.prototype.hasOwnProperty.call(input, textKey);
    if (!hasNum && !hasText) continue;

    const raw = hasNum ? input[numKey] : input[textKey];
    if (which === 'current' && (raw === 0 || raw === '0')) {
      updates[numKey] = 0;
      updates[textKey] = NOT_WORKING_TEXT;
      continue;
    }
    const read = readSalaryInput(raw, label);
    if (read.ok) {
      if (read.monthly === null) {
        updates[textKey] = '';
        updates[numKey] = undefined;
      } else {
        updates[numKey] = read.monthly;
        updates[textKey] = formatMonthly(read.monthly);
      }
      continue;
    }
    if (!opts.lenient || hasNum || typeof raw !== 'string') return { ok: false, error: read.error };
    // A spreadsheet cell such as "5 LPA" or "35k": converted, and the cell kept as typed.
    const parsed = parseMonthly(raw);
    if (parsed.monthly !== null && parsed.monthly >= SALARY_MIN && parsed.monthly <= SALARY_MAX) {
      updates[numKey] = parsed.monthly;
      updates[textKey] = formatMonthly(parsed.monthly);
      notes.push(`${label} "${raw.trim()}" read as ${formatMonthly(parsed.monthly)}.`);
    } else {
      updates[textKey] = '';
      updates[numKey] = undefined;
      notes.push(`${label} "${raw.trim()}" could not be read and was left blank.`);
    }
  }
  return { ok: true, updates, notes };
}

export interface SalaryReading {
  /** Rupees a month, or null when there is none. 0 means not working now. */
  monthly: number | null;
  /** Set when the figure was worked out from older free text, which is kept here. */
  fromText?: string;
  note?: string;
}

/** A candidate's current or expected salary: the typed number, else a reading of the older text. */
export function salaryOf(c: Partial<SalaryFields>, which: 'current' | 'expected'): SalaryReading {
  const n = which === 'current' ? c.current_salary_monthly : c.expected_salary_monthly;
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return { monthly: n };
  const text = ((which === 'current' ? c.current_salary : c.expected_salary) || '').trim();
  if (!text) return { monthly: null };
  if (which === 'current' && text === NOT_WORKING_TEXT) return { monthly: 0 };
  const parsed = parseMonthly(text);
  return { monthly: parsed.monthly, fromText: text, ...(parsed.note ? { note: parsed.note } : {}) };
}

/** How a salary reads on a page: "₹35,000 / month", "Not working now", the older text, or a dash. */
export function salaryLabel(c: Partial<SalaryFields>, which: 'current' | 'expected', empty = '—'): string {
  const r = salaryOf(c, which);
  if (r.monthly === 0) return NOT_WORKING_TEXT;
  if (r.fromText) return r.monthly ? `${formatMonthly(r.monthly)} (from “${r.fromText}”)` : r.fromText;
  return r.monthly ? formatMonthly(r.monthly) : empty;
}
