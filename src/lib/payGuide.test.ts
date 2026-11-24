import { describe, expect, it } from 'vitest';
import { checkOffer, matchRole, parseMonthly, parsePayGuide, potOf, rangeFor, tiersFor, yearsOf } from './payGuide';
import type { Candidate, PayGuide, PayRole } from './types';

const ctx = { subjects: ['Social Studies', 'Physics', 'English'], branchIds: ['b1', 'b2'], deciderIds: ['u1', 'admin'] };

const tiers = (a = 20000, b = 25000, c = 30000) => [
  { from_years: 0, to_years: 2, min: a, ideal: a + 2000, max: a + 5000 },
  { from_years: 2, to_years: 5, min: b, ideal: b + 3000, max: b + 8000 },
  { from_years: 5, to_years: null, min: c, ideal: c + 5000, max: c + 12000 },
];
const baseRole = (over: Record<string, unknown> = {}) => ({ name: 'Middle school Social Studies', grades: ['6', '7', '8'], subjects: ['Social Studies'], tiers: tiers(), ...over });
const parse = (roles: unknown[]) => parsePayGuide({ roles }, ctx);

describe('saving a Pay Guide', () => {
  it('accepts a good role and labels its tiers', () => {
    const r = parse([baseRole({ decider_user_id: 'u1', pot: { positions: 2, monthly_budget: 80000 }, bed_topup: 2000 })]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.guide.roles[0].tiers.map((t) => t.label)).toEqual(['0 to 2 years', '2 to 5 years', '5+ years']);
      expect(r.guide.roles[0].pot).toEqual({ positions: 2, monthly_budget: 80000 });
      expect(r.guide.roles[0].bed_topup).toBe(2000);
    }
  });

  it('refuses a role with no grades, a bad name, or a subject the school does not have', () => {
    expect(parse([baseRole({ grades: [] })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ name: 'x' })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ subjects: ['Astrology'] })])).toMatchObject({ ok: false });
    expect(parse([baseRole(), baseRole()])).toMatchObject({ ok: false });
  });

  it('refuses tiers that overlap, run out of order, or are not rupees', () => {
    const overlap = [{ from_years: 0, to_years: 3, min: 20000, ideal: 22000, max: 25000 }, { from_years: 2, to_years: null, min: 25000, ideal: 27000, max: 30000 }];
    expect(parse([baseRole({ tiers: overlap })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ tiers: [{ from_years: 0, to_years: null, min: 30000, ideal: 25000, max: 40000 }] })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ tiers: [{ from_years: 0, to_years: null, min: 5, ideal: 6, max: 7 }] })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ tiers: [{ from_years: 0, to_years: null, min: 20000, ideal: 22000, max: 25000 }, { from_years: 3, to_years: 9, min: 1, ideal: 2, max: 3 }] })])).toMatchObject({ ok: false });
  });

  it('only lets the last tier be open-ended', () => {
    const open = [{ from_years: 0, to_years: null, min: 20000, ideal: 22000, max: 25000 }, { from_years: 3, to_years: null, min: 25000, ideal: 27000, max: 30000 }];
    expect(parse([baseRole({ tiers: open })])).toMatchObject({ ok: false });
  });

  it('checks the decision-maker, the campus and the pot', () => {
    expect(parse([baseRole({ decider_user_id: 'stranger' })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ branch_tiers: { nowhere: tiers() } })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ pot: { positions: 0, monthly_budget: 50000 } })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ pot: { positions: 2, monthly_budget: 5 } })])).toMatchObject({ ok: false });
    expect(parse([baseRole({ bed_topup: 'lots' })])).toMatchObject({ ok: false });
  });
});

const guide: PayGuide = (() => {
  const r = parse([
    baseRole(),
    { name: 'Any middle school teacher', grades: ['6', '7', '8'], subjects: [], tiers: tiers(18000, 22000, 26000) },
    { name: 'Senior secondary Physics', grades: ['11', '12'], subjects: ['Physics'], tiers: tiers(30000, 38000, 46000), bed_topup: 3000, masters_topup: 4000, branch_tiers: { b2: tiers(35000, 43000, 51000) } },
  ]);
  if (!r.ok) throw new Error(r.error);
  return r.guide;
})();

const cand = (over: Partial<Candidate> = {}) => ({ id: 'c1', applied_subject: 'Social Studies', applied_segment: 'Middle school (Grades 6–8)', applied_grades: ['7'], experience_band: '2-4 years', qualification: 'Graduation', target_branch_id: 'b1', ...over } as Candidate);

describe('matching a candidate to a role', () => {
  it('prefers the role that names the subject', () => {
    expect(matchRole(guide, cand())?.name).toBe('Middle school Social Studies');
  });

  it('falls back to the any-subject role for another subject', () => {
    expect(matchRole(guide, cand({ applied_subject: 'English' }))?.name).toBe('Any middle school teacher');
  });

  it('matches on grades, not on a name, and returns null when nothing fits', () => {
    expect(matchRole(guide, cand({ applied_grades: ['11'], applied_subject: 'Physics' }))?.name).toBe('Senior secondary Physics');
    expect(matchRole(guide, cand({ applied_grades: ['2'], applied_subject: 'Maths' }))).toBeNull();
    expect(matchRole(undefined, cand())).toBeNull();
  });

  it('reads the grades from the segment when the candidate has none of their own', () => {
    expect(matchRole(guide, cand({ applied_grades: undefined }))?.name).toBe('Middle school Social Studies');
  });
});

describe('experience and salary figures', () => {
  it('uses the CV years when there are some, else the band', () => {
    expect(yearsOf({ experience_band: '2-4 years', resume_analysis: { total_experience_years: 6.25 } } as Candidate)).toEqual({ years: 6.3, source: 'cv' });
    expect(yearsOf({ experience_band: '2-4 years' } as Candidate)).toEqual({ years: 2, source: 'application' });
    expect(yearsOf({ experience_band: 'Fresher' } as Candidate).years).toBe(0);
    expect(yearsOf({ experience_band: '6+ years' } as Candidate).years).toBe(6);
  });

  it('reads the ways people write a salary', () => {
    expect(parseMonthly('35000').monthly).toBe(35000);
    expect(parseMonthly('₹ 30,000 per month').monthly).toBe(30000);
    expect(parseMonthly('35k').monthly).toBe(35000);
    expect(parseMonthly('6 LPA').monthly).toBe(50000);
    expect(parseMonthly('4.8 lakh').monthly).toBe(40000);
    expect(parseMonthly('600000').monthly).toBe(600000);
    expect(parseMonthly('4.5')).toMatchObject({ monthly: 37500, note: 'read as lakhs a year' });
    expect(parseMonthly('').monthly).toBeNull();
    expect(parseMonthly('negotiable').monthly).toBeNull();
  });
});

describe('the range for a candidate', () => {
  const social = guide.roles[0];
  const physics = guide.roles[2];

  it('picks the tier for their years', () => {
    expect(rangeFor(social, cand({ experience_band: 'Fresher' }))).toMatchObject({ tier_label: '0 to 2 years', min: 20000, max: 25000 });
    expect(rangeFor(social, cand({ experience_band: '2-4 years' }))).toMatchObject({ tier_label: '2 to 5 years', min: 25000, ideal: 28000, max: 33000 });
    expect(rangeFor(social, cand({ experience_band: '6+ years' }))).toMatchObject({ tier_label: '5+ years', min: 30000, max: 42000 });
  });

  it('puts the boundary year in the higher tier', () => {
    expect(rangeFor(social, cand({ experience_band: '1-2 years', resume_analysis: { total_experience_years: 2 } as never })).tier_label).toBe('2 to 5 years');
  });

  it('adds the B.Ed and master\'s top-ups', () => {
    const plain = rangeFor(physics, cand({ experience_band: 'Fresher', qualification: 'Graduation' }));
    const both = rangeFor(physics, cand({ experience_band: 'Fresher', qualification: 'M.Sc Physics with B.Ed' }));
    expect(plain.topup).toBe(0);
    expect(both.topup).toBe(7000);
    expect(both.min).toBe(plain.min + 7000);
    expect(both.topups).toEqual({ bed: true, masters: true });
  });

  it('uses a campus\'s own tiers when it has them', () => {
    expect(tiersFor(physics, 'b2')[0].min).toBe(35000);
    expect(tiersFor(physics, 'b1')[0].min).toBe(30000);
    expect(rangeFor(physics, cand({ experience_band: 'Fresher', target_branch_id: 'b2' })).campus_specific).toBe(true);
    expect(rangeFor(physics, cand({ experience_band: 'Fresher', target_branch_id: 'b1' })).campus_specific).toBe(false);
  });
});

describe('the pot and checking an offer', () => {
  const role = { ...guide.roles[0], pot: { positions: 2, monthly_budget: 60000 } } as PayRole;
  const offered = (id: string, monthly: number, status = 'approved', extra: Partial<Candidate> = {}) =>
    ({ id, final_offer: { role_id: role.id, monthly, status }, ...extra }) as unknown as Candidate;

  it('adds up the approved offers that still stand', () => {
    const pot = potOf(role, [offered('a', 28000), offered('b', 20000, 'pending_approval'), offered('c', 25000, 'approved', { rejected_by_candidate_at: 'x' })]);
    expect(pot).toMatchObject({ used_monthly: 28000, filled: 1, left_monthly: 32000, posts_left: 1 });
  });

  it('leaves out the candidate being decided on, so a changed offer is not counted twice', () => {
    expect(potOf(role, [offered('a', 28000)], 'a')?.used_monthly).toBe(0);
  });

  it('has no pot when the role has none', () => {
    expect(potOf(guide.roles[0], [])).toBeNull();
  });

  it('lets an offer inside the range and the pot go ahead', () => {
    const r = checkOffer(30000, { min: 25000, max: 33000 }, potOf(role, []));
    expect(r).toMatchObject({ over_range: false, over_pot: false, below_min: false, needs_approval: [] });
  });

  it('sends an offer above the range to the admin and says by how much', () => {
    const r = checkOffer(36000, { min: 25000, max: 33000 }, potOf(role, []));
    expect(r.over_range).toBe(true);
    expect(r.needs_approval[0]).toMatch(/3,000/);
  });

  it('sends an offer that would break the pot, or fill no free post, to the admin', () => {
    expect(checkOffer(30000, { min: 25000, max: 33000 }, potOf(role, [offered('a', 40000)])).over_pot).toBe(true);
    const full = potOf(role, [offered('a', 20000), offered('b', 20000)]);
    const r = checkOffer(21000, { min: 20000, max: 33000 }, full);
    expect(r.over_pot).toBe(true);
    expect(r.needs_approval[0]).toMatch(/posts/);
  });

  it('notes an offer below the minimum without needing approval for it', () => {
    const r = checkOffer(22000, { min: 25000, max: 33000 }, null);
    expect(r.below_min).toBe(true);
    expect(r.needs_approval).toEqual([]);
  });
});
