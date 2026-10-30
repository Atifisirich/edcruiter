import { describe, expect, it } from 'vitest';
import { countWords, gradeMcqs, MIN_LESSON_WORDS } from './testRules';

const qs = [
  { id: 'a', question_text: 'Capital of France?', options: ['Paris', 'Rome', 'Lyon', 'Nice'], correct_option: 'Paris' },
  { id: 'b', question_text: '2 + 2?', options: ['3', '4', '5', '6'], correct_option: '4' }
];

describe('gradeMcqs', () => {
  it('marks right and wrong answers from the stored key', () => {
    const g = gradeMcqs(qs, { a: 'Paris', b: '5' });
    expect(g.correct).toBe(1);
    expect(g.total).toBe(2);
    expect(g.unanswered).toEqual([]);
    expect(g.block).toContain('(Correct)');
    expect(g.block).toContain('(Incorrect)');
  });

  it('reports unanswered questions and does not accept an option that was not offered', () => {
    const g = gradeMcqs(qs, { a: 'Berlin' });
    expect(g.unanswered).toEqual(['a', 'b']);
    expect(g.correct).toBe(0);
  });

  it('ignores any "(Correct)" text a candidate tries to supply in an answer', () => {
    const g = gradeMcqs(qs, { a: 'Rome (Correct)', b: '4' });
    expect(g.correct).toBe(1);
    expect(g.unanswered).toEqual(['a']);
  });
});

describe('countWords', () => {
  it('counts words and ignores extra spaces', () => {
    expect(countWords('  one   two\nthree ')).toBe(3);
    expect(countWords('')).toBe(0);
    expect(countWords(undefined)).toBe(0);
  });

  it('has a lesson plan minimum worth enforcing', () => {
    expect(MIN_LESSON_WORDS).toBeGreaterThanOrEqual(100);
  });
});
