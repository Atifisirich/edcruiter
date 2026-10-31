import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssessmentPack, Candidate } from './types';
import { emptyBankState, type BankState } from './testBank';

let state: BankState = emptyBankState();
const updateCandidate = vi.fn();
const recordBankUse = vi.fn((ids: string[]) => { for (const id of ids) state.exposures[id] = (state.exposures[id] ?? 0) + 1; });

vi.mock('./db', () => ({
  db: {
    getBankState: () => state,
    recordBankUse: (ids: string[]) => recordBankUse(ids),
    updateCandidate: (...a: unknown[]) => updateCandidate(...a),
  },
}));

import { testFor } from './candidateTest';

const pack = {
  id: 'p1',
  mcqs: [{ id: 'm1', question_text: 'School test question?', options: ['a', 'b', 'c', 'd'], correct_option: 'a', category: 'subject' }],
} as unknown as AssessmentPack;

const bio = (extra: Partial<Candidate> = {}) =>
  ({ id: 'cand-1', school_id: 's1', applied_subject: 'Biology', applied_segment: 'Secondary (Grades 9 and 10)', applied_grades: ['9', '10'], ...extra }) as Candidate;

beforeEach(() => {
  vi.clearAllMocks();
  state = emptyBankState();
});

describe('a candidate\'s test', () => {
  it('is drawn from the bank, saved on the candidate, and counted as used', () => {
    const t = testFor(bio(), pack);
    expect(t.source).toBe('bank');
    expect(t.questions).toHaveLength(30);
    const saved = updateCandidate.mock.calls[0][2].test_set;
    expect(saved.ids).toHaveLength(30);
    expect(saved.subject).toBe('biology');
    expect(recordBankUse).toHaveBeenCalledWith(saved.ids);
  });

  it('is the same test when served again, and does not count as a second use', () => {
    const first = testFor(bio(), pack);
    const saved = updateCandidate.mock.calls[0][2].test_set;
    updateCandidate.mockClear();
    recordBankUse.mockClear();

    const again = testFor(bio({ test_set: saved }), pack);
    expect(again.questions).toEqual(first.questions);
    expect(updateCandidate).not.toHaveBeenCalled();
    expect(recordBankUse).not.toHaveBeenCalled();
  });

  it('keeps the answer key for marking', () => {
    const t = testFor(bio(), pack);
    for (const q of t.questions) expect(q.options).toContain(q.correct_option);
  });

  it('works out the grades from the older segment text when exact grades were never saved', () => {
    const t = testFor(bio({ applied_grades: undefined, applied_segment: 'Secondary (Grades 9-10)' }), pack);
    expect(t.source).toBe('bank');
  });

  it('uses the school\'s own test for a subject the bank does not cover yet', () => {
    const t = testFor(bio({ applied_subject: 'Chemistry' }), pack);
    expect(t.source).toBe('school_test');
    expect(t.questions.map((q) => q.id)).toEqual(['m1']);
    expect(updateCandidate).not.toHaveBeenCalled();
  });

  it('uses the school\'s own test when the bank has nothing for these grades', () => {
    const t = testFor(bio({ applied_grades: ['2'], applied_segment: 'Primary (Grade 2)' }), pack);
    expect(t.source).toBe('school_test');
  });

  it('differs from one candidate to the next', () => {
    const a = testFor(bio({ id: 'cand-a' }), pack).questions.map((q) => q.id).join(',');
    const b = testFor(bio({ id: 'cand-b' }), pack).questions.map((q) => q.id).join(',');
    expect(a).not.toBe(b);
  });
});
