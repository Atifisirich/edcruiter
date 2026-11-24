import { describe, expect, it } from 'vitest';
import { buildReview, DEFAULT_RUBRICS, GENERIC_RUBRIC, mayReview, parseRubric, reviewStillOwed, roundStage, rubricFor } from './roundReview';
import { parseRounds } from './reviewRounds';
import { DEFAULT_ROLES } from './roles';
import type { ReviewRound } from './types';

const coordinator: ReviewRound = { id: 'subject_lead', name: 'Coordinator', role_ids: ['REPORTING_MANAGER'] };
const rubric = rubricFor(coordinator);
const allFive = rubric.map((r) => ({ key: r.key, score: 5 }));
const by = { id: 'u1', name: 'Asha' };
const OPINION = 'Strong command of the subject and calm in front of a class.';

describe('rubrics', () => {
  it('has a ready-made rubric for each standard round and a generic one for others', () => {
    expect(rubricFor({ id: 'subject_lead' }).length).toBeGreaterThan(3);
    expect(rubricFor({ id: 'principal' })).toBe(DEFAULT_RUBRICS.principal);
    expect(rubricFor({ id: 'something_else' })).toBe(GENERIC_RUBRIC);
    expect(rubricFor(null)).toBe(GENERIC_RUBRIC);
  });

  it("uses the school's own rubric when it has set one", () => {
    const own = [{ key: 'a', label: 'Phonics' }];
    expect(rubricFor({ id: 'subject_lead', rubric: own })).toBe(own);
  });

  it('cleans an edited rubric, and refuses a bad one', () => {
    expect(parseRubric(undefined)).toEqual({ ok: true, rubric: undefined });
    expect(parseRubric([])).toEqual({ ok: true, rubric: undefined });
    const ok = parseRubric([{ label: '  Phonics   teaching ' }, { label: 'Storytelling' }]);
    expect(ok).toMatchObject({ ok: true });
    if (ok.ok) expect(ok.rubric).toEqual([{ key: 'phonics_teaching', label: 'Phonics teaching' }, { key: 'storytelling', label: 'Storytelling' }]);
    expect(parseRubric([{ label: 'Same' }, { label: 'same' }])).toMatchObject({ ok: false });
    expect(parseRubric([{ label: 'x' }])).toMatchObject({ ok: false });
    expect(parseRubric([{ label: '<b>hi</b>' }])).toMatchObject({ ok: false });
    expect(parseRubric(Array.from({ length: 11 }, (_, i) => ({ label: `Item number ${i}` })))).toMatchObject({ ok: false });
  });

  it('keeps a round\'s rubric when the admin saves the rounds', () => {
    const r = parseRounds([{ id: 'subject_lead', name: 'Coordinator', role_ids: ['REPORTING_MANAGER'], rubric: [{ label: 'Phonics' }] }], DEFAULT_ROLES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.rounds[0].rubric).toEqual([{ key: 'phonics', label: 'Phonics' }]);
  });
});

describe('a reviewer\'s report card', () => {
  it('works out the average as a percentage of full marks', () => {
    const r = buildReview({ recommendation: 'approve', ratings: allFive, opinion: OPINION }, rubric, by);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.review.average).toBe(100);
      expect(r.review.ratings).toHaveLength(rubric.length);
      expect(r.review.reviewer_name).toBe('Asha');
    }
    const half = buildReview({ recommendation: 'not_approve', ratings: rubric.map((x) => ({ key: x.key, score: 3 })), opinion: OPINION }, rubric, by);
    expect(half.ok && half.review.average).toBe(60);
  });

  it('needs approve or do not approve, every rating, and a real opinion', () => {
    expect(buildReview({ ratings: allFive, opinion: OPINION }, rubric, by)).toMatchObject({ ok: false });
    expect(buildReview({ recommendation: 'approve', ratings: allFive.slice(1), opinion: OPINION }, rubric, by)).toMatchObject({ ok: false });
    expect(buildReview({ recommendation: 'approve', ratings: allFive, opinion: 'ok' }, rubric, by)).toMatchObject({ ok: false });
    expect(buildReview({ recommendation: 'approve', ratings: allFive }, rubric, by)).toMatchObject({ ok: false });
  });

  it('refuses ratings outside one to five and ratings for items that are not on the rubric', () => {
    const bad = allFive.map((r, i) => (i === 0 ? { ...r, score: 6 } : r));
    expect(buildReview({ recommendation: 'approve', ratings: bad, opinion: OPINION }, rubric, by)).toMatchObject({ ok: false });
    const zero = allFive.map((r, i) => (i === 0 ? { ...r, score: 0 } : r));
    expect(buildReview({ recommendation: 'approve', ratings: zero, opinion: OPINION }, rubric, by)).toMatchObject({ ok: false });
    const extra = [...allFive, { key: 'nonsense', score: 1 }];
    const r = buildReview({ recommendation: 'approve', ratings: extra, opinion: OPINION }, rubric, by);
    expect(r.ok && r.review.ratings.map((x) => x.key)).toEqual(rubric.map((x) => x.key));
  });

  it('can approve with low ratings or refuse with high ones: the two are separate judgements', () => {
    const low = buildReview({ recommendation: 'approve', ratings: rubric.map((x) => ({ key: x.key, score: 1 })), opinion: OPINION }, rubric, by);
    expect(low.ok && low.review.recommendation).toBe('approve');
  });
});

describe('who reviews, and what is owed', () => {
  const sciHod = { id: 'u1', role: 'REPORTING_MANAGER' as const, role_id: 'REPORTING_MANAGER' };
  const other = { id: 'u2', role: 'REPORTING_MANAGER' as const, role_id: 'REPORTING_MANAGER' };
  const assigned = { round_assignments: { subject_lead: { user_id: 'u1', user_name: 'Asha', assigned_at: 'x', assigned_by_name: 'HR' } } };

  it('lets only the allocated reviewer review', () => {
    expect(mayReview(sciHod, assigned, coordinator)).toBe(true);
    expect(mayReview(other, assigned, coordinator)).toBe(false);
    expect(mayReview(sciHod, {}, coordinator)).toBe(false);
  });

  it('counts a booked interview as an allocation', () => {
    expect(mayReview(sciHod, {}, coordinator, [{ assigned_user_id: 'u1', round: 'subject_lead', status: 'scheduled' }])).toBe(true);
    expect(mayReview(sciHod, {}, coordinator, [{ assigned_user_id: 'u1', round: 'subject_lead', status: 'cancelled' }])).toBe(false);
  });

  it('needs the round\'s role, and never lets HR or another round\'s reviewer in', () => {
    expect(mayReview({ id: 'u1', role: 'HR', role_id: 'HR' }, assigned, coordinator)).toBe(false);
    expect(mayReview({ id: 'u1', role: 'INSTITUTE_HEAD', role_id: 'INSTITUTE_HEAD' }, assigned, coordinator)).toBe(false);
    expect(mayReview({ id: 'x', role: 'SCHOOL_ADMIN', role_id: 'SCHOOL_ADMIN' }, {}, coordinator)).toBe(true);
  });

  it('reports a review as owed only after an allocation with no review', () => {
    expect(reviewStillOwed({}, 'subject_lead')).toBe(false);
    expect(reviewStillOwed(assigned, 'subject_lead')).toBe(true);
    expect(reviewStillOwed({ ...assigned, round_reviews: { subject_lead: {} as never } }, 'subject_lead')).toBe(false);
  });

  it('names where a round stands', () => {
    expect(roundStage({}, 'subject_lead')).toBe('not_allocated');
    expect(roundStage(assigned, 'subject_lead')).toBe('waiting_review');
    expect(roundStage({ ...assigned, round_reviews: { subject_lead: {} as never } }, 'subject_lead')).toBe('reviewed');
    expect(roundStage(assigned, 'subject_lead', { status: 'cleared' })).toBe('passed');
    expect(roundStage(assigned, 'subject_lead', { status: 'rejected' })).toBe('stopped');
  });
});
