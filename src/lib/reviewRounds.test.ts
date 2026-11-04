import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUNDS, canDecideRound, currentRound, isSelected, parseRounds, roundResultOf, roundsOf } from './reviewRounds';
import { decide, mayTake } from './hiringDecision';
import { DEFAULT_ROLES, parseRoles, rolesOf } from './roles';
import type { Candidate, ReviewRound, RoleDef } from './types';

const NOW = '2026-11-04T10:00:00.000Z';
const actor = { id: 'u1', name: 'Asha Rao' };
const shortlisted = (over: Partial<Candidate> = {}) =>
  ({ id: 'c1', school_id: 's1', name: 'Ravi', status: 'passed', shortlist_status: 'shortlisted', ...over } as Candidate);

const roles: RoleDef[] = [
  { id: 'SCHOOL_ADMIN', name: 'Head of school', level: 'SCHOOL_ADMIN' },
  { id: 'HR', name: 'HR', level: 'HR' },
  { id: 'role_sci', name: 'Science HOD', level: 'REPORTING_MANAGER' },
  { id: 'role_vp', name: 'Vice principal', level: 'REPORTING_MANAGER' },
  { id: 'role_md', name: 'Managing director', level: 'FINAL_DECISION_MAKER' },
];
const custom: ReviewRound[] = [
  { id: 'r_sci', name: 'Science HOD', role_ids: ['role_sci'] },
  { id: 'r_demo', name: 'Demo class', role_ids: ['role_sci', 'role_vp'] },
  { id: 'r_vp', name: 'Vice principal', role_ids: ['role_vp'] },
  { id: 'r_md', name: 'MD', role_ids: ['role_md'] },
];

describe('who may do what', () => {
  it('lets HR run the shortlist and the offer, but not undo a decision or give a round yes or no', () => {
    const hr = { role: 'HR' as const, role_id: 'HR' };
    expect(mayTake('shortlist', hr)).toBe(true);
    expect(mayTake('reject', hr)).toBe(true);
    expect(mayTake('offer_sent', hr)).toBe(true);
    expect(mayTake('reopen', hr)).toBe(false);
    expect(mayTake('round_pass', hr, custom[0])).toBe(false);
  });

  it('lets a reviewer decide only the rounds their role is assigned to', () => {
    const sciHod = { role: 'REPORTING_MANAGER' as const, role_id: 'role_sci' };
    expect(mayTake('round_pass', sciHod, custom[0])).toBe(true);
    expect(mayTake('round_reject', sciHod, custom[1])).toBe(true);
    expect(mayTake('round_pass', sciHod, custom[2])).toBe(false);
    expect(mayTake('shortlist', sciHod)).toBe(false);
    expect(mayTake('offer_sent', sciHod)).toBe(false);
    expect(mayTake('reopen', sciHod)).toBe(false);
  });

  it('lets the school admin do everything', () => {
    const admin = { role: 'SCHOOL_ADMIN' as const, role_id: 'SCHOOL_ADMIN' };
    for (const action of ['shortlist', 'reopen', 'offer_sent'] as const) expect(mayTake(action, admin)).toBe(true);
    for (const r of custom) expect(mayTake('round_pass', admin, r)).toBe(true);
  });

  it('never lets HR decide a round, even if a round lists the HR role', () => {
    expect(canDecideRound({ role: 'HR', role_id: 'HR' }, { id: 'x', name: 'X', role_ids: ['HR'] })).toBe(false);
  });
});

describe('the standard rounds', () => {
  it('go to every role at the level that used to decide them', () => {
    const rounds = roundsOf({ roles });
    expect(rounds.map((r) => r.id)).toEqual(['subject_lead', 'principal', 'management']);
    expect(rounds[0].role_ids).toEqual(['role_sci', 'role_vp']);
    expect(rounds[2].role_ids).toEqual(['role_md']);
    // A school with only the standard roles keeps exactly the old behaviour.
    expect(roundsOf(undefined)).toEqual(DEFAULT_ROUNDS);
  });

  it('still read results saved the old way, so candidates part-way through keep their progress', () => {
    const c = shortlisted({ rm_clearance: { status: 'cleared', notes: 'Good', reviewer_name: 'Old HOD', completed_at: NOW } });
    expect(roundResultOf(c, 'subject_lead')).toMatchObject({ status: 'cleared', notes: 'Good', reviewer_name: 'Old HOD' });
    expect(roundResultOf(shortlisted({ ih_clearance: { status: 'pending', notes: '' } }), 'principal')).toBeUndefined();
    expect(currentRound(c, DEFAULT_ROUNDS)?.id).toBe('principal');
  });
});

describe('a school’s own rounds', () => {
  it('run in the order the admin set, and the last one is the final yes', () => {
    let c = shortlisted();
    for (const [i, r] of custom.entries()) {
      expect(currentRound(c, custom)?.id).toBe(r.id);
      const out = decide(c, { action: 'round_pass', round: r.id, note: `Opinion ${i}` }, actor, NOW, custom);
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      c = { ...c, ...(out.updates as Partial<Candidate>) };
    }
    expect(c.selected_at).toBe(NOW);
    expect(isSelected(c, custom)).toBe(true);
    expect(c.interview_decisions?.map((d) => d.round_label)).toEqual(['Science HOD', 'Demo class', 'Vice principal', 'MD']);
  });

  it('refuse a round out of order, and a yes without an opinion', () => {
    const early = decide(shortlisted(), { action: 'round_pass', round: 'r_vp', note: 'Fine' }, actor, NOW, custom);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toMatch(/Science HOD round first/);
    const silent = decide(shortlisted(), { action: 'round_pass', round: 'r_sci' }, actor, NOW, custom);
    expect(silent.ok).toBe(false);
  });

  it('are checked before they are saved', () => {
    const ok = parseRounds([{ name: 'Demo class', role_ids: ['role_sci', 'HR', 'nope'] }], roles, () => 'round_x');
    expect(ok).toEqual({ ok: true, rounds: [{ id: 'round_x', name: 'Demo class', role_ids: ['role_sci'] }] });
    expect(parseRounds([], roles).ok).toBe(false);
    expect(parseRounds([{ name: 'Only HR', role_ids: ['HR'] }], roles).ok).toBe(false);
    expect(parseRounds([{ name: 'A round', role_ids: ['role_sci'] }, { name: 'a round', role_ids: ['role_vp'] }], roles).ok).toBe(false);
    expect(parseRounds(Array.from({ length: 7 }, (_, i) => ({ name: `Round ${i}`, role_ids: ['role_sci'] })), roles).ok).toBe(false);
  });
});

describe('the HR role', () => {
  it('is added for a school that named its roles before HR existed', () => {
    const before = [{ id: 'SCHOOL_ADMIN', name: 'Head', level: 'SCHOOL_ADMIN' as const }, { id: 'role_sci', name: 'Science HOD', level: 'REPORTING_MANAGER' as const }];
    expect(rolesOf({ roles: before }).map((r) => r.id)).toEqual(['SCHOOL_ADMIN', 'HR', 'role_sci']);
    expect(DEFAULT_ROLES.some((r) => r.level === 'HR')).toBe(true);
  });

  it('lets a Principal role be shown as Reviewer without anyone losing access', () => {
    const members = [{ name: 'Meena', role: 'INSTITUTE_HEAD' as const, role_id: 'INSTITUTE_HEAD' }];
    const list = DEFAULT_ROLES.map((r) => (r.id === 'INSTITUTE_HEAD' ? { ...r, level: 'REPORTING_MANAGER' as const } : r));
    expect(parseRoles(list, members).ok).toBe(true);
    const toHr = DEFAULT_ROLES.map((r) => (r.id === 'INSTITUTE_HEAD' ? { ...r, level: 'HR' as const } : r));
    expect(parseRoles(toHr, members).ok).toBe(false);
  });
});
