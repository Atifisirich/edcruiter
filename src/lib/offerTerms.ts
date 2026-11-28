/**
 * What was agreed along with the salary: accommodation, provident fund and any
 * other condition, so the whole team knows what was offered. Pure, so it is
 * tested without a server.
 */
import type { OfferTerms } from './types';

export const MAX_TERM_TEXT = 500;

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/[ \t]+/g, ' ').trim().slice(0, MAX_TERM_TEXT) : '');
const choice = (v: unknown): 'yes' | 'no' | '' => (v === 'yes' || v === 'no' ? v : '');

export function readOfferTerms(input: unknown, by: string, now = new Date()): OfferTerms {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    accommodation: choice(r.accommodation),
    accommodation_note: clean(r.accommodation_note),
    pf: choice(r.pf),
    pf_note: clean(r.pf_note),
    other: clean(r.other),
    include_in_letter: r.include_in_letter === true,
    updated_by: by,
    updated_at: now.toISOString(),
  };
}

/** One plain line per agreed condition. Empty when nothing was recorded. */
export function termLines(t: OfferTerms | null | undefined): string[] {
  if (!t) return [];
  const line = (label: string, value: 'yes' | 'no' | '', note: string) =>
    !value && !note ? '' : `${label}: ${value === 'yes' ? 'Provided' : value === 'no' ? 'Not provided' : ''}${value && note ? ', ' : ''}${note}`;
  return [
    line('Accommodation', t.accommodation, t.accommodation_note),
    line('Provident fund (PF)', t.pf, t.pf_note),
    ...t.other.split(/\n+/).map((x) => x.trim()),
  ].filter(Boolean);
}
