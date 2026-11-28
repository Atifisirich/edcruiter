/**
 * What a candidate may see of their own results: that a stage is done, and,
 * once every stage is finished, their scores. Never the AI's comments, the
 * answer key, reviewers' notes or the camera checks. Pure, so it is tested
 * without a server.
 */
import type { StageResult } from './types';
import { stageScore100 } from './reportVerdict';
import { isSubjectDimension, parseWrittenSubmission } from './writtenAnswers';
import { ATTEMPT_STAGES } from './stageAttempts';

export interface CandidateScore {
  key: string;
  label: string;
  /** Out of 100. Null while it is still being marked. */
  score: number | null;
  /** Extra plain detail, such as "18 of 25 correct". */
  detail?: string;
}

/** The records without anything the candidate should not read. */
export function candidateStageResults(results: StageResult[]): Pick<StageResult, 'id' | 'school_id' | 'candidate_id' | 'stage_key' | 'stage_name' | 'completed_at'>[] {
  return results.map(({ id, school_id, candidate_id, stage_key, stage_name, completed_at }) => ({ id, school_id, candidate_id, stage_key, stage_name, completed_at }));
}

/** A score worked out offline from "was something submitted" is not a mark, so it is not shown as one. */
function marked(r?: StageResult): r is StageResult {
  return !!r?.ai_scores?.scores?.length && r.ai_scores.scoring_mode !== 'deterministic_fallback';
}

function dimensionAverage(r: StageResult, wanted: (dimension: string) => boolean): number | null {
  const dims = r.ai_scores!.scores!.filter((d) => wanted(d.dimension));
  return dims.length ? Math.round((dims.reduce((s, d) => s + (Number(d.score) || 0), 0) / dims.length) * 10) : null;
}

/** Null until every test stage is finished, so nobody sees a mark while still being tested. */
export function candidateScores(results: StageResult[]): CandidateScore[] | null {
  const done = new Set(results.map((r) => r.stage_key));
  if (!ATTEMPT_STAGES.every((k) => done.has(k))) return null;
  const find = (key: string) => results.find((r) => r.stage_key === key);

  const written = find('written_theory');
  const mcqs = parseWrittenSubmission(written?.written_submission)?.mcqs ?? [];
  const right = mcqs.filter((m) => m.correct).length;
  const demo = find('micro_teaching_demo');
  const scenario = find('situational_scenario');

  return [
    // The multiple-choice mark is exact, whoever marked the rest.
    { key: 'subject_test', label: 'Subject test', score: mcqs.length ? Math.round((right / mcqs.length) * 100) : null, ...(mcqs.length ? { detail: `${right} of ${mcqs.length} correct` } : {}) },
    { key: 'lesson_plan', label: 'Lesson plan', score: marked(written) ? dimensionAverage(written, (d) => !isSubjectDimension(d)) : null },
    { key: 'teaching_demo', label: 'Teaching demo', score: marked(demo) ? stageScore100(demo) : null },
    { key: 'classroom_scenario', label: 'Classroom scenario', score: marked(scenario) ? stageScore100(scenario) : null },
  ];
}
