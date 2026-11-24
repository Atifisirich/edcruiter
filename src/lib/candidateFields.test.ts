import { describe, expect, it } from 'vitest';
import { candidateSelfView, candidateView, pickAllowed } from './candidateFields';
import type { Candidate } from './types';

describe('what a candidate may set about themselves', () => {
  it('keeps profile fields and drops everything about decisions, scores and the face check', () => {
    const picked = pickAllowed({
      name: 'Asha', dob: '1995-02-03', phone: '9', qualification: 'B.Ed',
      status: 'hired', shortlist_status: 'shortlisted', total_ai_score: 99, age: 5,
      face_reference: { photo_url: 'x', descriptors: [], captured_at: 'y' }, extra_attempts: { written_theory: 9 },
      rm_clearance: { status: 'cleared', notes: '' },
    });
    expect(Object.keys(picked).sort()).toEqual(['dob', 'name', 'phone', 'qualification']);
  });
});

describe('what a candidate’s browser is sent', () => {
  const candidate = {
    id: 'c1', name: 'Asha',
    test_set: { subject: 'english', ids: ['eng-0001'], drawn_at: 'now' },
    face_reference: { photo_url: '/api/media/face_1.jpg', descriptors: [[0.1, 0.2]], captured_at: 'now' },
  } as unknown as Candidate;

  it('has the photo but never the face measurements or the question ids', () => {
    const view = candidateView(candidate);
    expect(view.face_reference).toEqual({ photo_url: '/api/media/face_1.jpg', descriptors: [], captured_at: 'now', measured: true });
    expect('test_set' in view).toBe(false);
  });

  it('says the check is not available when only the photo was kept', () => {
    const view = candidateView({ ...candidate, face_reference: { photo_url: 'p', descriptors: [], captured_at: 'now' } } as Candidate);
    expect(view.face_reference?.measured).toBe(false);
  });

  it('leaves a candidate with no photo alone', () => {
    const view = candidateView({ id: 'c2', name: 'B' } as Candidate);
    expect(view.face_reference).toBeUndefined();
  });
});

describe('what a candidate may see of their own record', () => {
  const full = {
    id: 'c1',
    name: 'Ravi',
    round_assignments: { subject_lead: { user_id: 'u1', user_name: 'Asha', assigned_at: 'x', assigned_by_name: 'HR' } },
    round_reviews: { subject_lead: { reviewer_id: 'u1', reviewer_name: 'Asha', recommendation: 'not_approve', ratings: [], average: 40, opinion: 'Weak on basics', submitted_at: 'x' } },
    round_questions: { subject_lead: { subject: ['q'], other: ['q'], generated_at: 'x', source: 'ai' } },
    round_results: { subject_lead: { status: 'cleared', notes: 'ok', completed_at: 'x' } },
    interview_decisions: [{ reason: 'Weak' }],
    rejected_by_school_reason: 'Not a fit',
    total_ai_score: 41,
  } as unknown as Candidate;

  it("never carries reviewers' opinions, ratings, allocations, questions or the school's reasons", () => {
    const view = candidateSelfView(full) as unknown as Record<string, unknown>;
    for (const key of ['round_assignments', 'round_reviews', 'round_questions', 'round_results', 'interview_decisions', 'rejected_by_school_reason', 'total_ai_score']) {
      expect(view[key]).toBeUndefined();
    }
    expect(view.name).toBe('Ravi');
  });

  it('leaves everything for staff', () => {
    const view = candidateView(full) as unknown as Record<string, unknown>;
    expect(view.round_reviews).toBeDefined();
    expect(view.rejected_by_school_reason).toBe('Not a fit');
  });

  it('does not let a candidate write a review, an allocation or a question list about themselves', () => {
    expect(pickAllowed({ name: 'Ravi', round_reviews: { x: 1 }, round_assignments: { x: 1 }, round_questions: { x: 1 } })).toEqual({ name: 'Ravi' });
  });
});
