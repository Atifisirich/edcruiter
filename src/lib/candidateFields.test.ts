import { describe, expect, it } from 'vitest';
import { candidateView, pickAllowed } from './candidateFields';
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
