import { describe, expect, it } from 'vitest';
import { currentRound, decide } from './hiringDecision';
import { candidateState } from './candidateProgress';
import type { Candidate } from './types';

const actor = { id: 'u1', name: 'Asha Rao' };
const NOW = '2026-11-01T10:00:00.000Z';

const base = (over: Partial<Candidate> = {}): Candidate => ({
  id: 'c1', school_id: 's1', name: 'Atif', email: 'a@b.c', phone: '9', dob: '1995-01-01', qualification: 'B.Ed',
  experience_band: 'Fresher', prior_org: '', current_salary: '', expected_salary: '', current_location: '', relocation_branches: [],
  languages: [], notice_period: '', applied_segment: 'Primary', applied_subject: 'English', target_branch_id: '', status: 'in_progress',
  current_stage_key: 'hr_policy_briefing', created_at: NOW, updated_at: NOW, ...over,
} as Candidate);

const ok = (c: Candidate, input: Parameters<typeof decide>[1]) => {
  const r = decide(c, input, actor, NOW);
  if (!r.ok) throw new Error(r.error);
  return r;
};

describe('after reading the report', () => {
  it('shortlists, which moves the candidate to the Shortlisted tab', () => {
    const r = ok(base(), { action: 'shortlist' });
    expect(r.updates).toMatchObject({ shortlist_status: 'shortlisted', status: 'passed' });
    expect(candidateState({ ...base(), ...(r.updates as Partial<Candidate>) }).tab).toBe('shortlisted');
  });

  it('puts on hold without moving them out of review', () => {
    const r = ok(base(), { action: 'hold' });
    expect(candidateState({ ...base(), ...(r.updates as Partial<Candidate>) }).label).toBe('On hold');
  });

  it('needs a reason to turn someone down, records it, and says the candidate should be told', () => {
    const none = decide(base(), { action: 'reject', note: ' ' }, actor, NOW);
    expect(none.ok).toBe(false);
    const r = ok(base(), { action: 'reject', note: 'Subject depth was weak' });
    expect(r.updates).toMatchObject({ status: 'rejected', shortlist_status: 'rejected', rejected_by_school_at: NOW, rejected_by_school_reason: 'Subject depth was weak' });
    expect(r.declinesCandidate).toBe(true);
    expect(candidateState({ ...base(), ...(r.updates as Partial<Candidate>) }).tab).toBe('rejected');
  });

  it('reopens someone who was turned down and clears the reason', () => {
    const rejected = base({ status: 'rejected', shortlist_status: 'rejected', rejected_by_school_at: NOW, rejected_by_school_reason: 'x' });
    const r = ok(rejected, { action: 'reopen' });
    const back = { ...rejected, ...(r.updates as Partial<Candidate>) };
    expect(back.rejected_by_school_at).toBeNull();
    expect(candidateState(back).tab).not.toBe('rejected');
    expect(decide(base(), { action: 'reopen' }, actor, NOW).ok).toBe(false);
  });

  it('will not shortlist or hold someone already turned down', () => {
    const rejected = base({ status: 'rejected', rejected_by_school_at: NOW });
    expect(decide(rejected, { action: 'shortlist' }, actor, NOW).ok).toBe(false);
    expect(decide(rejected, { action: 'hold' }, actor, NOW).ok).toBe(false);
  });
});

describe('the interview rounds', () => {
  const shortlisted = () => base({ status: 'passed', shortlist_status: 'shortlisted' });

  it('are only open to a shortlisted candidate', () => {
    expect(decide(base(), { action: 'round_pass', round: 'subject_lead' }, actor, NOW).ok).toBe(false);
  });

  it('go in order, and say which one is up next', () => {
    expect(currentRound(shortlisted())).toBe('subject_lead');
    const r = decide(shortlisted(), { action: 'round_pass', round: 'principal' }, actor, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/subject lead interview first/i);
  });

  it('record who cleared a round, from the session, and move to the next', () => {
    const r = ok(shortlisted(), { action: 'round_pass', round: 'subject_lead', note: 'Good rapport' });
    expect(r.updates.rm_clearance).toMatchObject({ status: 'cleared', notes: 'Good rapport', reviewer_name: 'Asha Rao' });
    expect(r.updates.interview_decisions).toEqual([expect.objectContaining({ round: 'subject_lead', decision: 'accepted', reviewer_id: 'u1', reviewer_name: 'Asha Rao' })]);
    const after = { ...shortlisted(), ...(r.updates as Partial<Candidate>) };
    expect(currentRound(after)).toBe('principal');
  });

  it('stop the process with a reason, and tell the candidate', () => {
    expect(decide(shortlisted(), { action: 'round_reject', round: 'subject_lead' }, actor, NOW).ok).toBe(false);
    const r = ok(shortlisted(), { action: 'round_reject', round: 'subject_lead', note: 'Could not explain fractions' });
    expect(r.updates).toMatchObject({ status: 'rejected', shortlist_status: 'rejected', rejected_by_school_reason: 'Could not explain fractions' });
    expect(r.declinesCandidate).toBe(true);
  });

  it('end with the management interview selecting the teacher, and the offer letter marking them hired', () => {
    let c = shortlisted();
    for (const round of ['subject_lead', 'principal', 'management'] as const) {
      const r = ok(c, { action: 'round_pass', round });
      c = { ...c, ...(r.updates as Partial<Candidate>) };
    }
    expect(c.selected_at).toBe(NOW);
    expect(c.status).toBe('passed');
    expect(candidateState(c).tab).toBe('selected');
    expect(currentRound(c)).toBeNull();

    expect(decide(base(), { action: 'offer_sent' }, actor, NOW).ok).toBe(false);
    const sent = ok(c, { action: 'offer_sent' });
    expect(sent.updates).toMatchObject({ offer_letter_sent_at: NOW, status: 'hired' });
  });

  it('record a teacher who declined, with a reason', () => {
    expect(decide(shortlisted(), { action: 'candidate_declined' }, actor, NOW).ok).toBe(false);
    const r = ok(shortlisted(), { action: 'candidate_declined', note: 'Took another offer' });
    expect(r.updates).toMatchObject({ rejected_by_candidate_at: NOW, rejected_by_candidate_reason: 'Took another offer', status: 'rejected' });
    expect(r.declinesCandidate).toBe(false);
  });
});
