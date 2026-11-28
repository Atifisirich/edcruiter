import { describe, expect, it } from 'vitest';
import { buildSentLetter, fillTemplate, joiningDateProblem, letterDetails, parseTemplates, STANDARD_LETTER, tagsIn } from './offerTemplates';
import type { Candidate, School } from './types';

const today = new Date(2026, 10, 26); // 26 Nov 2026
const candidate = { id: 'cand_1', school_id: 's1', name: 'Asha Reddy', email: 'a@x.in', phone: '9', applied_subject: 'English', applied_segment: 'Primary (Grades 1 to 5)' } as Candidate;
const school = {
  id: 's1', name: 'Green Valley School', primary_contact: { name: 'Mrs Rao' }, branches: [{ id: 'b1', name: 'Main campus', location: 'Hyderabad' }],
  offer_letter_templates: [{ id: 'olt_abcd1', name: 'Primary', body: 'Dear {candidate_name}, {monthly_salary} from {joining_date} at {campus}.', updated_at: '' }],
} as unknown as School;

describe('the joining date', () => {
  it('waits for the whole date', () => {
    expect(joiningDateProblem('', today)).toMatch(/Choose/);
    expect(joiningDateProblem('0002-12-01', today)).toMatch(/four digits/); // the year still being typed
    expect(joiningDateProblem('2026-02-30', today)).toMatch(/does not exist/);
    expect(joiningDateProblem('2026-11-25', today)).toMatch(/past/);
    expect(joiningDateProblem('2028-01-01', today)).toMatch(/12 months/);
    expect(joiningDateProblem('2026-12-01', today)).toBeNull();
    expect(joiningDateProblem('2026-11-26', today)).toBeNull();
  });
});

describe('templates', () => {
  it('finds tags and refuses unknown ones', () => {
    expect(tagsIn('Hi {candidate_name} {foo}')).toEqual({ used: ['candidate_name', 'foo'], unknown: ['foo'] });
    expect(parseTemplates([{ name: 'A letter', body: 'Dear {foo}, welcome to the school.' }], 'HR').ok).toBe(false);
  });
  it('checks names and keeps ids', () => {
    const ok = parseTemplates([{ name: ' Primary  letter ', body: 'Dear {candidate_name}, welcome aboard.' }], 'HR', '2026-11-26T00:00:00Z');
    expect(ok.ok && ok.templates[0].name).toBe('Primary letter');
    expect(ok.ok && ok.templates[0].id).toMatch(/^olt_/);
    expect(parseTemplates([{ name: 'X', body: 'Dear {candidate_name}, welcome aboard.' }], 'HR').ok).toBe(false);
    expect(parseTemplates([{ name: STANDARD_LETTER, body: 'Dear {candidate_name}, welcome aboard.' }], 'HR').ok).toBe(false);
    const twice = [{ name: 'Same', body: 'Dear {candidate_name}, welcome aboard.' }, { name: 'same', body: 'Dear {candidate_name}, welcome aboard.' }];
    expect(parseTemplates(twice, 'HR').ok).toBe(false);
  });
  it('fills tags and says what is missing', () => {
    const d = letterDetails(candidate, school, { monthly: 35000, joining_iso: '2026-12-01', campus: 'Main campus' }, '2026-11-26');
    expect(d.monthly_salary).toBe('₹35,000');
    expect(d.annual_ctc).toBe('₹4,20,000');
    const f = fillTemplate('Dear {candidate_name}, {monthly_salary} at {campus}. {signatory}', d);
    expect(f.text).toBe('Dear Asha Reddy, ₹35,000 at Main campus. Mrs Rao');
    expect(fillTemplate('{campus}', { ...d, branch_name: '' }).missing).toEqual(['campus']);
  });
});

describe('the letter that is sent', () => {
  it('is built on the server from real figures', () => {
    const r = buildSentLetter({ monthly: 35000, joining_iso: '2026-12-01', campus: 'Main campus', template_id: 'olt_abcd1' }, candidate, school, 'HR Priya', today);
    expect(r.ok && r.letter.template_name).toBe('Primary');
    expect(r.ok && r.letter.text).toBe('Dear Asha Reddy, ₹35,000 from 1 December 2026 at Main campus.');
    const std = buildSentLetter({ monthly: 35000, joining_iso: '2026-12-01', campus: 'Main campus' }, candidate, school, 'HR Priya', today);
    expect(std.ok && std.letter.template_name).toBe(STANDARD_LETTER);
  });
  it('is refused when something is not real', () => {
    expect(buildSentLetter({ monthly: 35, joining_iso: '2026-12-01', campus: 'Main campus' }, candidate, school, 'HR', today).ok).toBe(false);
    expect(buildSentLetter({ monthly: 35000, joining_iso: '0002-12-01', campus: 'Main campus' }, candidate, school, 'HR', today).ok).toBe(false);
    expect(buildSentLetter({ monthly: 35000, joining_iso: '2026-12-01', campus: 'Elsewhere' }, candidate, school, 'HR', today).ok).toBe(false);
    expect(buildSentLetter({ monthly: 35000, joining_iso: '2026-12-01', campus: 'Main campus', template_id: 'olt_gone1' }, candidate, school, 'HR', today).ok).toBe(false);
  });
});

describe('a copy of a letter sent earlier', () => {
  it('is dated to the day it was sent and checked against that day', () => {
    const sentAt = new Date('2026-09-10T06:00:00.000Z');
    const r = buildSentLetter({ monthly: 35000, joining_iso: '2026-10-01', campus: 'Main campus' }, candidate, school, 'HR', sentAt);
    expect(r.ok && r.letter.details.issue_date).toBe('10 September 2026');
    expect(r.ok && r.letter.sent_at).toBe(sentAt.toISOString());
  });
});
