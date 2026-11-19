import { describe, expect, it } from 'vitest';
import { presentOwnTest, usesOwnQuestions } from './ownTest';
import { cleanPackEdits, ownQuestionsProblem } from './packEdit';
import type { AssessmentPack } from './types';

const mcqs = Array.from({ length: 8 }, (_, i) => ({
  id: `m${i}`,
  question_text: `Question ${i}?`,
  options: [`right ${i}`, `wrong a ${i}`, `wrong b ${i}`, `wrong c ${i}`],
  correct_option: `right ${i}`,
  category: 'subject' as const,
}));

type Own = Pick<AssessmentPack, 'use_own_questions' | 'mcqs'>;

describe('a school test as a candidate takes it', () => {
  it('has every question once, each with its right answer among the options', () => {
    const t = presentOwnTest(mcqs, 'cand-1');
    expect(t.map((q) => q.id).sort()).toEqual(mcqs.map((q) => q.id).sort());
    for (const q of t) expect(q.options).toContain(q.correct_option);
  });
  it('is the same for the same candidate and go, and different for another', () => {
    expect(presentOwnTest(mcqs, 'cand-1', 1)).toEqual(presentOwnTest(mcqs, 'cand-1', 1));
    expect(presentOwnTest(mcqs, 'cand-1', 1).map((q) => q.id)).not.toEqual(presentOwnTest(mcqs, 'cand-2', 1).map((q) => q.id));
  });
  it('is only used when switched on and there are enough questions', () => {
    expect(usesOwnQuestions({ use_own_questions: true, mcqs })).toBe(true);
    expect(usesOwnQuestions({ use_own_questions: false, mcqs })).toBe(false);
    expect(usesOwnQuestions({ use_own_questions: true, mcqs: mcqs.slice(0, 2) })).toBe(false);
    expect(usesOwnQuestions(null)).toBe(false);
  });
});

const good = { id: 'q1', question_text: ' What is the pH of pure water? ', options: ['7', '1', '14', '0'], correct_option: '7', explanation: 'Neutral.', category: 'subject' };

describe('checking edits to a school test', () => {
  it('accepts a good question and tidies it', () => {
    const r = cleanPackEdits({ mcqs: [good] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.updates.mcqs?.[0]).toMatchObject({ id: 'q1', question_text: 'What is the pH of pure water?', correct_option: '7' });
  });
  it('refuses a question with no text, too few answers, repeated answers or no right answer', () => {
    expect(cleanPackEdits({ mcqs: [{ ...good, question_text: '  ' }] })).toMatchObject({ ok: false });
    expect(cleanPackEdits({ mcqs: [{ ...good, options: ['7'] }] })).toMatchObject({ ok: false });
    expect(cleanPackEdits({ mcqs: [{ ...good, options: ['7', '7 ', '1'] }] })).toMatchObject({ ok: false });
    expect(cleanPackEdits({ mcqs: [{ ...good, correct_option: 'seven' }] })).toMatchObject({ ok: false });
  });
  it('says which question is wrong', () => {
    const r = cleanPackEdits({ mcqs: [good, { ...good, id: 'q2', correct_option: 'zzz' }] });
    expect(r).toEqual({ ok: false, error: 'Question 2: choose which answer is correct.' });
  });
  it('gives new questions an id, and a repeated id a fresh one', () => {
    const r = cleanPackEdits({ mcqs: [{ ...good, id: '' }, good, good] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ids = r.updates.mcqs!.map((q) => q.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids.every(Boolean)).toBe(true);
    }
  });
  it('matches the right answer ignoring capital letters, and stores it as written in the list', () => {
    const r = cleanPackEdits({ mcqs: [{ ...good, options: ['Seven', 'One'], correct_option: 'seven' }] });
    expect(r.ok && r.updates.mcqs?.[0].correct_option).toBe('Seven');
  });
  it('ignores fields that are not editable, and refuses blank tasks or titles', () => {
    const r = cleanPackEdits({ school_id: 's2', status: 'active', id: 'x', lesson_prompt: ' Plan a lesson. ' });
    expect(r).toEqual({ ok: true, updates: { lesson_prompt: 'Plan a lesson.' } });
    expect(cleanPackEdits({ demo_rubric: '  ' })).toMatchObject({ ok: false });
    expect(cleanPackEdits({ title: ' ' })).toMatchObject({ ok: false });
  });
  it('needs enough questions before the test can be used on its own', () => {
    expect(ownQuestionsProblem({ use_own_questions: true, mcqs: mcqs.slice(0, 3) } as Own)).toMatch(/at least 5/);
    expect(ownQuestionsProblem({ use_own_questions: true, mcqs } as Own)).toBeNull();
    expect(ownQuestionsProblem({ use_own_questions: false, mcqs: [] } as Own)).toBeNull();
  });
});
