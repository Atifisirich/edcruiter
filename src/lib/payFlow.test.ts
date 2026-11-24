import { describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ db: { getCandidatesBySchool: () => [], getUsersBySchool: () => [], addNotification: () => undefined } }));

import { buildFinalOffer, deciderOf, mayDecidePay } from './payFlow';
import type { PayRole, User } from './types';

const role = { id: 'r1', name: 'Social Studies, Grades 6-8', decider_user_id: 'p1' } as PayRole;
const range = { tier_id: 't', tier_label: '2 to 5 years', min: 25000, ideal: 28000, max: 33000, topup: 0, topups: { bed: false, masters: false }, campus_specific: false };
const pot = { positions: 2, monthly_budget: 60000, used_monthly: 0, filled: 0, left_monthly: 60000, posts_left: 2 };
const by = { id: 'p1', name: 'Principal Rao' };

describe('who takes the final call', () => {
  const users = [{ id: 'p1', name: 'Principal Rao' }, { id: 'a1', name: 'Admin' }] as User[];

  it('is the person management named, else the school admin', () => {
    expect(deciderOf(role, users)).toEqual({ id: 'p1', name: 'Principal Rao' });
    expect(deciderOf({ decider_user_id: undefined }, users).name).toBe('the school admin');
    expect(deciderOf({ decider_user_id: 'gone' }, users).name).toBe('the school admin');
  });

  it('lets only that person, or the admin, set the offer', () => {
    expect(mayDecidePay({ id: 'p1', role: 'INSTITUTE_HEAD' }, role)).toBe(true);
    expect(mayDecidePay({ id: 'p2', role: 'INSTITUTE_HEAD' }, role)).toBe(false);
    expect(mayDecidePay({ id: 'hr', role: 'HR' }, role)).toBe(false);
    expect(mayDecidePay({ id: 'a1', role: 'SCHOOL_ADMIN' }, role)).toBe(true);
    expect(mayDecidePay({ id: 'p1', role: 'INSTITUTE_HEAD' }, { decider_user_id: undefined })).toBe(false);
  });
});

describe('making the offer', () => {
  it('approves an offer inside the range and the pot straight away', () => {
    const { offer, check } = buildFinalOffer({ monthly: 30000, role, range, years: 3, pot, by });
    expect(offer.status).toBe('approved');
    expect(check.needs_approval).toEqual([]);
    expect(offer).toMatchObject({ monthly: 30000, tier_label: '2 to 5 years', decided_by: 'Principal Rao', over_range: false, over_pot: false });
  });

  it('holds an offer above the range for the admin, and keeps the reason', () => {
    const { offer, check } = buildFinalOffer({ monthly: 36000, reason: '  Ten years of Physics and the only candidate.  ', role, range, years: 3, pot, by });
    expect(offer.status).toBe('pending_approval');
    expect(offer.over_range).toBe(true);
    expect(offer.reason).toBe('Ten years of Physics and the only candidate.');
    expect(check.needs_approval[0]).toMatch(/3,000/);
  });

  it('holds an offer that would break the pot', () => {
    const tight = { ...pot, left_monthly: 20000, used_monthly: 40000, filled: 1, posts_left: 1 };
    expect(buildFinalOffer({ monthly: 28000, role, range, years: 3, pot: tight, by }).offer.status).toBe('pending_approval');
  });

  it('keeps the earlier figure and the notes when the offer is changed', () => {
    const first = buildFinalOffer({ monthly: 36000, reason: 'Strong candidate overall', role, range, years: 3, pot, by, nowIso: '2026-11-01T00:00:00.000Z' }).offer;
    const withNote = { ...first, status: 'refused' as const, counters: [{ at: 'x', by: 'HR', note: 'Wants 35000' }] };
    const second = buildFinalOffer({ monthly: 31000, role, range, years: 3, pot, by, previous: withNote }).offer;
    expect(second.status).toBe('approved');
    expect(second.history).toEqual([{ at: '2026-11-01T00:00:00.000Z', by: 'Principal Rao', monthly: 36000, status: 'refused' }]);
    expect(second.counters).toHaveLength(1);
  });
});
