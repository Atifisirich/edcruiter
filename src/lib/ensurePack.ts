import { db } from './db';
import type { AssessmentPack, StageKey } from './types';
import { generateAssessmentPackData, type GeneratedPackData } from './assessmentPackGenerator';
import { normalizeSubject, pickActivePack } from './subjectMatch';

/** Saves a written test and the three scoring rubrics that go with it. */
export function savePackWithRubrics(schoolId: string, data: GeneratedPackData, status: AssessmentPack['status'], title?: string): AssessmentPack {
  const pack: AssessmentPack = {
    id: `pack_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...data,
    school_id: schoolId,
    title: title || data.title,
    status,
    created_at: new Date().toISOString()
  };
  db.createAssessmentPack(pack);

  (['written_theory', 'micro_teaching_demo', 'situational_scenario'] as StageKey[]).forEach((stage_key, idx) => {
    const rubricText = idx === 0 ? pack.lesson_rubric : idx === 1 ? pack.demo_rubric : pack.scenario_rubric;
    db.addOrUpdateRubric({
      id: `rubric_${pack.id}_${stage_key}`,
      school_id: schoolId,
      stage_key,
      role_type: 'Teacher',
      subject: pack.subject,
      segment: pack.segment,
      dimensions: [{ id: 'ai_generated', name: 'Edcruiter AI rubric', description: rubricText, weight: 100 }]
    });
  });
  return pack;
}

const inflight = new Map<string, Promise<AssessmentPack | null>>();
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 60_000;

export function findActivePack(schoolId: string, subject?: string, segment?: string): AssessmentPack | null {
  return pickActivePack(db.getAssessmentPacksBySchool(schoolId), subject, segment);
}

export type PackState =
  | { state: 'ready'; pack: AssessmentPack }
  | { state: 'preparing' }
  | { state: 'failed'; error: string };

const lastError = new Map<string, string>();

/**
 * Makes sure the school has an active test for this subject and grade level,
 * writing one in the background if it does not. Safe to call repeatedly: only
 * one is written at a time per school, subject and grade, and a failed attempt
 * is not retried for a minute.
 */
export function ensureActivePack(schoolId: string, subject: string, segment: string): PackState {
  const existing = findActivePack(schoolId, subject, segment);
  if (existing) return { state: 'ready', pack: existing };

  const key = `${schoolId}|${subject.toLowerCase()}|${segment.toLowerCase()}`;
  if (inflight.has(key)) return { state: 'preparing' };

  const failed = failedAt.get(key);
  if (failed && Date.now() - failed < RETRY_AFTER_MS) {
    return { state: 'failed', error: lastError.get(key) || 'The test could not be prepared. Try again in a minute.' };
  }

  const school = db.getSchoolById(schoolId);
  const board = school?.curricula?.[0] || 'CBSE';
  const work = generateAssessmentPackData({ subject, segment, board })
    .then((data) => {
      failedAt.delete(key);
      // Another request may have saved one while this was writing.
      return findActivePack(schoolId, subject, segment) || savePackWithRubrics(schoolId, data, 'active');
    })
    .catch((err) => {
      failedAt.set(key, Date.now());
      lastError.set(key, err instanceof Error ? err.message : 'The test could not be prepared.');
      console.error('Could not prepare test:', err);
      return null;
    })
    .finally(() => { inflight.delete(key); });
  inflight.set(key, work);
  return { state: 'preparing' };
}

/**
 * Strips the answer key and grading rubrics before a pack reaches a candidate.
 * The previous version sent mcqs[].correct_option and every stage rubric to
 * the browser verbatim — a candidate could open devtools and read both the
 * quiz answers and the exact criteria they would be scored against before
 * (or during) the assessment.
 */
export function sanitizeForCandidate(pack: AssessmentPack) {
  return {
    ...pack,
    mcqs: (pack.mcqs || []).map(({ correct_option: _correct_option, explanation: _explanation, ...rest }) => rest),
    pedagogy_mcqs: undefined,
    lesson_rubric: undefined,
    demo_rubric: undefined,
    scenario_rubric: undefined,
  };
}

/**
 * Writes the test for a subject and grade level ahead of time, so a candidate
 * who opens their link later finds it ready. Returns when it has finished, for
 * use inside after().
 */
export async function warmPack(schoolId: string, subject: string, segment: string): Promise<void> {
  const name = normalizeSubject(subject);
  if (!name || name === 'general') return;
  const state = ensureActivePack(schoolId, subject, segment);
  if (state.state !== 'preparing') return;
  await inflight.get(`${schoolId}|${subject.toLowerCase()}|${segment.toLowerCase()}`);
}
