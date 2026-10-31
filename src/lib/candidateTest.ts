/**
 * Which questions a candidate gets, and the answer key to mark them against.
 *
 * Where the platform bank has enough questions for the candidate's subject and
 * grades, they get their own random draw, saved on their record so a reload (or
 * the marking, later) sees the same questions. Where it does not yet, they get
 * the test the school's AI wrote, exactly as before.
 */

import { db } from './db';
import { drawTest, resolveTest, type DrawnQuestion } from './testBank';
import { cleanGrades, gradesFromSegment } from './grades';
import { normalizeSubject } from './subjectMatch';
import type { AssessmentPack, Candidate } from './types';

export interface CandidateTest {
  questions: DrawnQuestion[];
  source: 'bank' | 'school_test';
}

function gradesOf(candidate: Pick<Candidate, 'applied_grades' | 'applied_segment'>): string[] {
  const own = cleanGrades(candidate.applied_grades);
  return own.length ? own : gradesFromSegment(candidate.applied_segment);
}

function fromPack(pack: AssessmentPack): DrawnQuestion[] {
  return (pack.mcqs || []).map((m) => ({
    id: m.id,
    question_text: m.question_text,
    options: m.options,
    correct_option: m.correct_option,
    explanation: m.explanation,
    category: m.category === 'pedagogy' ? 'pedagogy' : 'subject',
  }));
}

export function testFor(candidate: Candidate, pack: AssessmentPack): CandidateTest {
  const subject = normalizeSubject(candidate.applied_subject);

  // A test already given to this candidate is always the one served and marked.
  if (candidate.test_set && candidate.test_set.subject === subject) {
    const questions = resolveTest(candidate.test_set.ids, candidate.id);
    if (questions.length === candidate.test_set.ids.length) return { questions, source: 'bank' };
  }

  const drawn = drawTest({ subject, grades: gradesOf(candidate), candidateId: candidate.id, state: db.getBankState() });
  if (drawn.ok) {
    db.updateCandidate(candidate.school_id, candidate.id, {
      test_set: { subject, ids: drawn.ids, drawn_at: new Date().toISOString() },
    });
    db.recordBankUse(drawn.ids);
    return { questions: drawn.questions, source: 'bank' };
  }

  return { questions: fromPack(pack), source: 'school_test' };
}
