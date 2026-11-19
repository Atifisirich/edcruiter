import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssessmentPack, Candidate, StageAttempt } from './types';
import { emptyBankState } from './testBank';

let saved: StageAttempt[] = [];
const recordBankUse = vi.fn();
const updateCandidate = vi.fn();
vi.mock('./db', () => ({
  db: {
    getStageAttempts: () => saved,
    saveStageAttempt: (a: StageAttempt) => { saved = [...saved.filter((x) => x.id !== a.id), a]; },
    addProctoringEvent: () => undefined,
    getBankState: () => emptyBankState(),
    recordBankUse: (...a: unknown[]) => recordBankUse(...a),
    updateCandidate: (...a: unknown[]) => updateCandidate(...a),
  },
}));

import { beginAttempt } from './attemptService';

const mcqs = Array.from({ length: 6 }, (_, i) => ({
  id: `own${i}`,
  question_text: `Own question ${i}?`,
  options: [`right ${i}`, `a ${i}`, `b ${i}`, `c ${i}`],
  correct_option: `right ${i}`,
  category: 'subject' as const,
}));

const packWith = (extra: Partial<AssessmentPack>) =>
  ({ id: 'p1', school_id: 's1', subject: 'Biology', board: 'CBSE', mcqs, lesson_prompt: 'Plan a lesson.', demo_prompt: '', scenario_prompt: '', ...extra }) as unknown as AssessmentPack;

const candidate = { id: 'cand-1', school_id: 's1', applied_subject: 'Biology', applied_segment: 'Secondary (Grades 9 and 10)', applied_grades: ['9', '10'] } as Candidate;

beforeEach(() => {
  saved = [];
  vi.clearAllMocks();
});

describe('beginning the subject test when the school wrote its own questions', () => {
  it('gives every candidate those questions, without the answer key, and keeps the key with the go', async () => {
    const r = await beginAttempt(candidate, packWith({ use_own_questions: true }), 'written_theory');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.content.mcqs).toHaveLength(6);
    expect(r.content.mcqs!.map((q) => q.id).sort()).toEqual(mcqs.map((q) => q.id).sort());
    for (const q of r.content.mcqs!) expect(q).not.toHaveProperty('correct_option');

    const stored = saved[0];
    expect(stored.own_questions).toHaveLength(6);
    for (const q of stored.own_questions!) expect(q.options).toContain(q.correct_option);
    expect(stored.test_ids).toBeUndefined();
    // The bank is not touched at all.
    expect(recordBankUse).not.toHaveBeenCalled();
    expect(updateCandidate).not.toHaveBeenCalled();
  });

  it('keeps the questions a go began with, even if the school edits the test while the candidate is part way through', async () => {
    const first = await beginAttempt(candidate, packWith({ use_own_questions: true }), 'written_theory');
    const edited = packWith({ use_own_questions: true, mcqs: mcqs.map((m) => ({ ...m, question_text: `CHANGED ${m.id}` })) });
    const again = await beginAttempt(candidate, edited, 'written_theory');
    expect(first.ok && again.ok).toBe(true);
    if (first.ok && again.ok) {
      expect(again.resumed).toBe(true);
      expect(again.content.mcqs).toEqual(first.content.mcqs);
    }
  });

  it('draws from the bank exactly as before when the school never switched to its own questions', async () => {
    const r = await beginAttempt(candidate, packWith({}), 'written_theory');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(saved[0].own_questions).toBeUndefined();
    expect(saved[0].test_ids).toHaveLength(30);
    expect(r.content.mcqs).toHaveLength(30);
    expect(recordBankUse).toHaveBeenCalled();
  });

  it('also ignores the switch when the test has too few questions', async () => {
    const r = await beginAttempt(candidate, packWith({ use_own_questions: true, mcqs: mcqs.slice(0, 2) }), 'written_theory');
    expect(r.ok).toBe(true);
    expect(saved[0].own_questions).toBeUndefined();
    expect(saved[0].test_ids).toHaveLength(30);
  });
});
