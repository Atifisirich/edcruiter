import { describe, expect, it } from 'vitest';
import { gradeMcqs } from './testRules';
import { isSubjectDimension, parseWrittenSubmission } from './writtenAnswers';

describe('parseWrittenSubmission', () => {
  it('reads back what gradeMcqs writes, right, wrong and unanswered', () => {
    const graded = gradeMcqs(
      [
        { id: '1', question_text: 'Roots absorb?', options: ['A. Water', 'B. Light'], correct_option: 'A. Water' },
        { id: '2', question_text: 'Leaves take in?', options: ['A. CO2', 'B. O2'], correct_option: 'A. CO2' },
        { id: '3', question_text: 'Unanswered one?', options: ['A. x', 'B. y'], correct_option: 'B. y' },
      ],
      { 1: 'A. Water', 2: 'B. O2' },
    );
    const text = `MCQ TEST\n\n${graded.block}\n\n--- LESSON PLAN ---\n\nObjective: fractions.\n\nActivity: pizza.`;
    const parsed = parseWrittenSubmission(text)!;
    expect(parsed.mcqs).toEqual([
      { question: 'Roots absorb?', selected: 'A. Water', key: 'A. Water', correct: true },
      { question: 'Leaves take in?', selected: 'B. O2', key: 'A. CO2', correct: false },
      { question: 'Unanswered one?', selected: null, key: 'B. y', correct: false },
    ]);
    expect(parsed.lessonPlan).toBe('Objective: fractions.\n\nActivity: pizza.');
  });

  it('keeps brackets inside an answer', () => {
    const p = parseWrittenSubmission('MCQ TEST\n\nQ: Which?\nSelected: A. Leaves (via stomata)\nKey: B. Roots (via root hair cells) (Incorrect)\n\n--- LESSON PLAN ---\n\nx');
    expect(p!.mcqs[0]).toEqual({ question: 'Which?', selected: 'A. Leaves (via stomata)', key: 'B. Roots (via root hair cells)', correct: false });
  });

  it('returns null for free text so it is shown as it is', () => {
    expect(parseWrittenSubmission('I would calm the class first.')).toBeNull();
    expect(parseWrittenSubmission('')).toBeNull();
  });

  it('sorts dimensions', () => {
    expect(isSubjectDimension('subject_depth')).toBe(true);
    expect(isSubjectDimension('lesson_design')).toBe(false);
  });
});
