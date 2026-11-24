import { describe, expect, it } from 'vitest';
import {
  autoRange, blankRole, copyRole, defaultTiers, displayName, fromServer, isComplete, levelLabel, payRangeText, previewRange, problemsOf, setEdge, setUsual,
  sharesLevels, toServer, typicalRoles,
} from './payGuideEdit';
import { parsePayGuide } from './payGuide';
import type { PayRole } from './types';

const filled = () => {
  const r = blankRole('b1');
  r.grades = ['6', '7', '8'];
  r.tiers = r.tiers.map((t, i) => setUsual(t, String([22000, 30000, 40000][i])));
  return r;
};
const ctx = { subjects: ['Physics'], branchIds: ['b1', 'b2'], deciderIds: ['u1'] };

describe('filling in a job', () => {
  it('starts with three levels of experience and nothing else to decide', () => {
    const r = blankRole('b1');
    expect(r.tiers.map(levelLabel)).toEqual(['Under 2 years', '2 to 5 years', '5 years and above']);
    expect(r.branch).toBe('b1');
    expect(defaultTiers().every((t) => t.auto)).toBe(true);
  });

  it('fills the lowest and highest from the usual pay, and stops when the admin changes one', () => {
    let t = setUsual(defaultTiers()[0], '30000');
    expect(t).toMatchObject({ min: '27000', ideal: '30000', max: '34500' });
    t = setEdge(t, 'max', '36000');
    expect(t.auto).toBe(false);
    t = setUsual(t, '32000');
    expect(t).toMatchObject({ ideal: '32000', min: '27000', max: '36000' });
    expect(autoRange(1000)).toEqual({ min: 1000, max: 1000 });
  });

  it('says what is still missing, in plain words', () => {
    const r = blankRole('b1');
    const p = problemsOf(r);
    expect(p[0]).toMatch(/grades/);
    expect(p.some((x) => /pay for Under 2 years/.test(x))).toBe(true);
    expect(isComplete(r)).toBe(false);
  });

  it('is ready once the grades and every level have pay', () => {
    expect(problemsOf(filled())).toEqual([]);
    expect(isComplete(filled())).toBe(true);
  });

  it('catches pay that is out of order, years that overlap, and half a budget', () => {
    const r = filled();
    r.tiers[1] = { ...r.tiers[1], min: '35000', ideal: '30000' };
    expect(problemsOf(r).join(' ')).toMatch(/lowest must be under the usual/);
    const o = filled();
    o.tiers[1] = { ...o.tiers[1], from: '1' };
    expect(problemsOf(o).join(' ')).toMatch(/overlap/);
    const b = filled();
    b.positions = '3';
    expect(problemsOf(b).join(' ')).toMatch(/budget/);
  });

  it('names a job from what it covers when the admin does not', () => {
    const r = filled();
    r.subjects = ['Physics'];
    expect(displayName(r)).toBe('Grades 6 to 8 · Physics teacher');
    r.name = 'Our physics team';
    expect(displayName(r)).toBe('Our physics team');
  });

  it('shows one line of pay for the card', () => {
    expect(payRangeText(filled())).toBe('₹20,000 to ₹46,000 a month');
    expect(payRangeText(blankRole())).toBe('No pay set yet');
  });
});

describe('what the decision-maker would see', () => {
  it('picks the level for the years and adds the degree top-ups', () => {
    const r = filled();
    r.bed = '2000';
    r.masters = '3000';
    expect(previewRange(r, 0, false, false)).toMatchObject({ level: 'Under 2 years', ideal: 22000 });
    expect(previewRange(r, 3, false, false)).toMatchObject({ level: '2 to 5 years', ideal: 30000 });
    expect(previewRange(r, 9, true, true)).toMatchObject({ level: '5 years and above', ideal: 45000, topup: 5000 });
  });

  it('says nothing until the pay is filled in', () => {
    expect(previewRange(blankRole(), 3, false, false)).toBeNull();
  });
});

describe('starting points and copies', () => {
  it('starts from the usual stages of a school, for one campus', () => {
    const jobs = typicalRoles('b1');
    expect(jobs.map((j) => j.name)).toEqual(['Pre-primary teacher', 'Primary teacher', 'Middle school teacher', 'Secondary teacher', 'Senior secondary teacher']);
    expect(jobs.every((j) => j.branch === 'b1' && j.grades.length > 0)).toBe(true);
    expect(jobs.every((j) => !isComplete(j))).toBe(true);
    expect(sharesLevels(jobs)).toBe(true);
  });

  it('copies a job to another campus as a new job that has to be given its own decision-maker', () => {
    const r = { ...filled(), id: 'saved1', decider: 'u1' };
    r.tiers = r.tiers.map((t) => ({ ...t, id: 'tier_x' }));
    const c = copyRole(r, 'b2');
    expect(c.id).toBeUndefined();
    expect(c.branch).toBe('b2');
    expect(c.decider).toBe('');
    expect(c.tiers.every((t) => t.id === undefined)).toBe(true);
    expect(c.key).not.toBe(r.key);
    expect(copyRole(r, 'b1', 'Copy of it').decider).toBe('u1');
  });

  it('can tell when jobs can be filled in as one table', () => {
    const a = filled();
    const b = filled();
    b.tiers = b.tiers.slice(0, 2);
    expect(sharesLevels([a, filled()])).toBe(true);
    expect(sharesLevels([a, b])).toBe(false);
    expect(sharesLevels([])).toBe(false);
  });
});

describe('sending a job to the server', () => {
  it('produces something the server accepts, with the campus and a made-up name', () => {
    const r = filled();
    r.bed = '2000';
    r.positions = '2';
    r.budget = '60000';
    const sent = toServer(r);
    expect(sent.name).toBe('Grades 6 to 8 · teacher');
    expect(sent.branch_id).toBe('b1');
    const parsed = parsePayGuide({ roles: [sent] }, ctx);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.guide.roles[0]).toMatchObject({ branch_id: 'b1', bed_topup: 2000, pot: { positions: 2, monthly_budget: 60000 } });
  });

  it('round-trips a saved job', () => {
    const parsed = parsePayGuide({ roles: [toServer(filled())] }, ctx);
    if (!parsed.ok) throw new Error(parsed.error);
    const role: PayRole = parsed.guide.roles[0];
    const back = fromServer(role);
    expect(back.id).toBe(role.id);
    expect(back.tiers.map((t) => t.ideal)).toEqual(['22000', '30000', '40000']);
    expect(isComplete(back)).toBe(true);
  });
});
