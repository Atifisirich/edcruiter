/**
 * A school's own test, as one candidate takes it. Every candidate gets the same
 * questions, but in their own order and with the answer options in their own
 * order, so one person cannot simply pass "number 7 is the third one" to the
 * next. Repeatable from the candidate id and the go number alone.
 */

import { seededRandom, shuffle, type DrawnQuestion } from './testBank';
import type { AssessmentPack } from './types';

export function presentOwnTest(mcqs: AssessmentPack['mcqs'], candidateId: string, go = 1): DrawnQuestion[] {
  const random = seededRandom(`${candidateId}|own-test|go${go}`);
  return shuffle(mcqs, random).map((m) => ({
    id: m.id,
    question_text: m.question_text,
    options: shuffle(m.options, random),
    correct_option: m.correct_option,
    explanation: m.explanation,
    category: m.category === 'pedagogy' ? 'pedagogy' : 'subject',
  }));
}

/** The fewest questions a school's own test can have before candidates are given it instead of the bank. */
export const MIN_OWN_QUESTIONS = 5;

export function usesOwnQuestions(pack: Pick<AssessmentPack, 'use_own_questions' | 'mcqs'> | null | undefined): boolean {
  return !!pack?.use_own_questions && (pack.mcqs?.length ?? 0) >= MIN_OWN_QUESTIONS;
}
