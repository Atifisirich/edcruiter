import { describe, expect, it } from 'vitest';
import { candidateScores, candidateStageResults } from './candidateResults';
import { candidateSelfView } from './candidateFields';
import { readOfferTerms, termLines } from './offerTerms';
import { fillTemplate, letterDetails } from './offerTemplates';
import type { Candidate, StageResult } from './types';

const result = (stage_key: string, extra: Partial<StageResult> = {}) => ({ id: stage_key, school_id: 's', candidate_id: 'c', stage_key, stage_name: stage_key, completed_at: '', ...extra }) as StageResult;
const dims = (pairs: [string, number][], mode?: string) => ({ ai_scores: { scores: pairs.map(([dimension, score]) => ({ dimension, score, justification: 'private note' })), scoring_mode: mode } }) as never;
const written = result('written_theory', {
  written_submission: 'MCQ TEST\n\nQ: One?\nSelected: A\nKey: A (Correct)\n\nQ: Two?\nSelected: B\nKey: C (Incorrect)\n\n--- LESSON PLAN ---\n\nPlan.',
  ...(dims([['subject_depth', 5], ['lesson_design', 7]]) as object),
});
const all = [
  result('identity_verification'), written,
  result('micro_teaching_demo', dims([['teaching_delivery', 6], ['student_engagement', 8]])),
  result('situational_scenario', dims([['student_empathy', 5]], 'deterministic_fallback')),
  result('hr_policy_briefing'),
];

describe('what a candidate sees of their results', () => {
  it('shows nothing until every stage is finished', () => {
    expect(candidateScores(all.slice(0, 4))).toBeNull();
  });
  it('then shows marks only, and never a provisional one as a mark', () => {
    expect(candidateScores(all)).toEqual([
      { key: 'subject_test', label: 'Subject test', score: 50, detail: '1 of 2 correct' },
      { key: 'lesson_plan', label: 'Lesson plan', score: 70 },
      { key: 'teaching_demo', label: 'Teaching demo', score: 70 },
      { key: 'classroom_scenario', label: 'Classroom scenario', score: null },
    ]);
  });
  it('strips comments, answers and the answer key from the records', () => {
    const text = JSON.stringify(candidateStageResults(all));
    expect(text).not.toContain('private note');
    expect(text).not.toContain('Key:');
  });
  it('keeps the pay discussion from the candidate', () => {
    const view = candidateSelfView({ name: 'A', final_offer: { monthly: 1 }, offer_terms: { other: 'x' } } as never) as Record<string, unknown>;
    expect(view.final_offer).toBeUndefined();
    expect(view.offer_terms).toBeUndefined();
  });
});

describe('offer conditions', () => {
  const terms = readOfferTerms({ accommodation: 'yes', accommodation_note: 'shared room', pf: 'no', other: 'Free transport\nLaptop', include_in_letter: true }, 'Principal');
  const candidate = { id: 'c', school_id: 's', name: 'Asha', email: '', phone: '', applied_subject: 'English', applied_segment: 'Primary' } as Candidate;

  it('reads them into plain lines', () => {
    expect(termLines(terms)).toEqual(['Accommodation: Provided, shared room', 'Provident fund (PF): Not provided', 'Free transport', 'Laptop']);
    expect(termLines(readOfferTerms({ pf: 'maybe' }, 'x'))).toEqual([]);
  });
  it('go into the letter only when chosen', () => {
    const input = { monthly: 30000, joining_iso: '2026-12-01', campus: 'Main' };
    const shown = letterDetails({ ...candidate, offer_terms: terms }, null, input);
    expect(shown.terms).toHaveLength(4);
    expect(fillTemplate('Dear {candidate_name}', shown).text).toContain('- Free transport');
    expect(letterDetails({ ...candidate, offer_terms: { ...terms, include_in_letter: false } }, null, input).terms).toBeUndefined();
  });
});
