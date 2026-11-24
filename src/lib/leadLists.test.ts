import { describe, expect, it } from 'vitest';
import { estimate, leadsCsv, listReport, phoneKey, verdictForCall } from './leadLists';
import { cleanSetup, offLimits } from './leadSetup';
import type { Candidate, ScreeningCheck } from './types';

const rules = { retries: 2, max_callbacks: 2 };
const must = (result: ScreeningCheck['result'], requirement = 'Has a B.Ed'): ScreeningCheck => ({ question: 'Q', requirement, result, importance: 'must' });
const pref = (result: ScreeningCheck['result'], requirement = '30 days or less'): ScreeningCheck => ({ question: 'Q', requirement, result, importance: 'prefer' });
const answered = (over: object = {}) => ({ status: 'completed' as const, recommendation: 'proceed' as const, checks: [] as ScreeningCheck[], interest: 'interested' as const, ...over });

describe('what a call means for a lead', () => {
  it('passes a good fit by HR’s own must-haves', () => {
    expect(verdictForCall(answered({ checks: [must('met'), pref('met')] }), rules)).toEqual({ kind: 'good_fit' });
  });

  it('sets aside a missed must-have, with the must-have as the reason', () => {
    expect(verdictForCall(answered({ checks: [must('not_met')] }), rules)).toEqual({ kind: 'set_aside', reason: { text: 'Not met: Has a B.Ed', key: 'has a b ed' } });
    expect(verdictForCall(answered({ interest: 'not_interested' }), rules)).toMatchObject({ kind: 'set_aside', reason: { key: 'not interested' } });
  });

  it('sends the unclear ones to HR for a look, never sets them aside', () => {
    expect(verdictForCall(answered({ checks: [must('unclear')] }), rules)).toMatchObject({ kind: 'needs_look', reason: { text: 'Could not confirm: Has a B.Ed' } });
    expect(verdictForCall(answered({ checks: [must('met'), pref('not_met')] }), rules)).toMatchObject({ kind: 'needs_look', reason: { text: 'Preference not met: 30 days or less' } });
    expect(verdictForCall(answered({ recommendation: 'maybe' }), rules)).toMatchObject({ kind: 'needs_look' });
  });

  it('tries again when nobody picks up, then sets aside', () => {
    expect(verdictForCall({ status: 'no_answer', attempt: 1 }, rules)).toEqual({ kind: 'retry' });
    expect(verdictForCall({ status: 'busy', attempt: 2 }, rules)).toEqual({ kind: 'retry' });
    expect(verdictForCall({ status: 'no_answer', attempt: 3 }, rules)).toEqual({ kind: 'set_aside', reason: { text: 'No answer after 3 tries', key: 'no answer' } });
    expect(verdictForCall({ status: 'failed', failure_reason: 'DND' }, rules)).toMatchObject({ kind: 'set_aside', reason: { key: 'call failed' } });
  });

  it('rings back when asked, until the call-backs run out', () => {
    const cb = { callback: { when_text: 'after 4 pm', at: '2026-11-24T10:30:00Z' } };
    expect(verdictForCall(answered({ ...cb, callback_count: 0 }), rules)).toMatchObject({ kind: 'call_back', when_text: 'after 4 pm' });
    expect(verdictForCall(answered({ ...cb, callback_count: 2 }), rules)).toMatchObject({ kind: 'needs_look' });
    expect(verdictForCall({ status: 'calling' }, rules)).toEqual({ kind: 'wait' });
  });
});

describe('the list report', () => {
  const lead = (status: NonNullable<Candidate['lead']>['status'], reason?: [string, string], invited = false) => ({ lead: { list_id: 'l', status, updated_at: '', invited, ...(reason ? { reason: reason[0], reason_key: reason[1] } : {}) } });
  it('counts results, reasons and spend', () => {
    const leads = [
      lead('moved', undefined, true), lead('moved'), lead('needs_look', ['Could not confirm: Has a B.Ed', 'has a b ed']),
      lead('set_aside', ['Not met: Has a B.Ed', 'has a b ed']), lead('set_aside', ['Not met: Has a B.Ed', 'has a b ed']),
      lead('set_aside', ['No answer after 3 tries', 'no answer']), lead('waiting'),
    ];
    const ids = leads.map((_, i) => `c${i}`);
    const calls = new Map(ids.map((id, i) => [id, i < 5 ? [{ status: 'completed' as const, price_inr: 27, duration_sec: 150, started_at: '', mode: 'live' as const }] : i === 5 ? [{ status: 'no_answer' as const, started_at: '', mode: 'live' as const }] : []]));
    const r = listReport(leads, calls, ids);
    expect(r).toMatchObject({ total: 7, good_fit: 2, moved: 2, invited: 1, needs_look: 1, set_aside: 3, waiting: 1, called: 6, answered: 5, spent_inr: 135, minutes: 15 });
    expect(r.reasons[0]).toEqual({ key: 'has a b ed', text: 'Not met: Has a B.Ed', count: 2, status: 'set_aside' });
    expect(r.reasons.find((x) => x.key === 'no answer')?.text).toBe('No answer');
    expect(r.progress).toBe(86);
  });

  it('estimates the cost and time before starting', () => {
    expect(estimate(400, 9, { concurrent: 3, windowHours: 10 })).toEqual({ calls: 400, cost_inr: 7560, hours: 8.9, days: 1 });
  });
});

describe('the screening HR sets up', () => {
  it('never asks about age, religion, caste, marriage, pregnancy or gender', () => {
    expect(offLimits('How old are you?')).toBe('age');
    expect(offLimits('Are you married?')).toBe('marriage');
    expect(offLimits('What is your caste?')).toBe('religion or caste');
    expect(offLimits('Do you have a B.Ed degree?')).toBeNull();
    const r = cleanSetup({
      good_fit: 'Maths teacher with a B.Ed',
      questions: [
        { question: 'Are you still interested in this maths teaching job?', importance: 'ask' },
        { question: 'Do you have a B.Ed degree?', importance: 'must', wanted: 'Has a B.Ed' },
        { question: 'Are you married, and do you plan to have children soon?', importance: 'must', wanted: 'Single' },
        { question: 'What salary do you expect each month?', importance: 'prefer', wanted: '' },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.setup.questions).toEqual(['Are you still interested in this maths teaching job?', 'Do you have a B.Ed degree?', 'What salary do you expect each month?']);
    expect(r.setup.importance).toEqual(['ask', 'must', 'ask']);
    expect(r.setup.left_out?.[0]).toMatch(/marriage/);
  });

  it('refuses a setup with no usable question', () => {
    expect(cleanSetup({ questions: [] }).ok).toBe(false);
  });
});

describe('small helpers', () => {
  it('matches phone numbers however they are written', () => {
    expect(phoneKey('+91 98480 12345')).toBe('9848012345');
    expect(phoneKey('09848012345')).toBe('9848012345');
    expect(phoneKey('12345')).toBe('');
  });

  it('writes a spreadsheet that Excel cannot run formulas from', () => {
    const csv = leadsCsv([{ name: '=HYPERLINK("x")', phone: '98480', email: '', subject: 'Maths, Science', status: 'Set aside', reason: 'Not met: B.Ed', summary: 'Said "no"', called_at: '' }]);
    expect(csv.split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",98480,,"Maths, Science",Set aside,Not met: B.Ed,"Said ""no""",`);
  });
});
