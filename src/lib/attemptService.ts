import { db } from './db';
import { createProctoringEvent } from './proctoringEngine';
import { decideAttempt, MAX_ATTEMPTS, sinceText, ATTEMPT_STAGES } from './stageAttempts';
import { drawTest, resolveTest, type DrawnQuestion } from './testBank';
import { cleanGrades, gradesFromSegment } from './grades';
import { normalizeSubject } from './subjectMatch';
import { freshTask, type TaskKind } from './freshTask';
import { presentOwnTest, usesOwnQuestions } from './ownTest';
import type { AssessmentPack, Candidate, StageAttempt, StageKey } from './types';

/** What the candidate is shown for one go at a stage. Never includes an answer key. */
export interface AttemptContent {
  mcqs?: Array<{ id: string; question_text: string; options: string[]; category: 'subject' | 'pedagogy' }>;
  prompt?: string;
}

export interface BeganAttempt {
  attempt: StageAttempt;
  resumed: boolean;
  allowed: number;
  content: AttemptContent;
}

export type BeginResult = ({ ok: true } & BeganAttempt) | { ok: false; reason: 'blocked'; used: number; allowed: number };

const TASK_KIND: Partial<Record<StageKey, TaskKind>> = {
  written_theory: 'lesson',
  micro_teaching_demo: 'demo',
  situational_scenario: 'scenario',
};

function schoolPrompt(pack: AssessmentPack, stage: StageKey): string | undefined {
  if (stage === 'written_theory') return pack.lesson_prompt;
  if (stage === 'micro_teaching_demo') return pack.demo_prompt;
  if (stage === 'situational_scenario') return pack.scenario_prompt;
  return undefined;
}

function gradesOf(c: Pick<Candidate, 'applied_grades' | 'applied_segment'>): string[] {
  const own = cleanGrades(c.applied_grades);
  return own.length ? own : gradesFromSegment(c.applied_segment);
}

function stripKey(qs: DrawnQuestion[]) {
  return qs.map(({ id, question_text, options, category }) => ({ id, question_text, options, category }));
}

/** Last time each open attempt's page said hello. Kept in memory and written out now and then, so a ping is cheap. */
const lastSeen = new Map<string, { at: number; saved: number }>();
const SAVE_EVERY_MS = 60_000;

export function recordPing(attempt: StageAttempt, nowMs: number = Date.now()): void {
  const known = lastSeen.get(attempt.id);
  if (!known || nowMs - known.saved >= SAVE_EVERY_MS) {
    lastSeen.set(attempt.id, { at: nowMs, saved: nowMs });
    db.saveStageAttempt({ ...attempt, last_seen_at: new Date(nowMs).toISOString() });
  } else {
    lastSeen.set(attempt.id, { at: nowMs, saved: known.saved });
  }
}

/** The freshest sign of life for an attempt, from memory if the page pinged more recently than it was saved. */
function seenAt(attempt: StageAttempt): string {
  const known = lastSeen.get(attempt.id);
  return known && known.at > Date.parse(attempt.last_seen_at) ? new Date(known.at).toISOString() : attempt.last_seen_at;
}

function contentFor(candidate: Candidate, pack: AssessmentPack, attempt: StageAttempt): AttemptContent {
  const content: AttemptContent = {};
  if (attempt.stage_key === 'written_theory') {
    if (attempt.own_questions?.length) {
      // The school's own test, as it was when this go began.
      content.mcqs = stripKey(attempt.own_questions);
    } else if (attempt.test_ids?.length) {
      content.mcqs = stripKey(resolveTest(attempt.test_ids, candidate.id));
    } else {
      // The school's own written test: the same questions, in a different order each go.
      const order = [...(pack.mcqs || [])];
      const start = attempt.number > 1 ? attempt.number % Math.max(1, order.length) : 0;
      const rotated = [...order.slice(start), ...order.slice(0, start)];
      content.mcqs = stripKey(rotated.map((m) => ({
        id: m.id, question_text: m.question_text, options: m.options, correct_option: m.correct_option,
        explanation: m.explanation, category: m.category === 'pedagogy' ? 'pedagogy' : 'subject',
      })));
    }
  }
  content.prompt = attempt.prompt ?? schoolPrompt(pack, attempt.stage_key);
  return content;
}

/**
 * Opens a stage for a candidate: carries on with the go in progress, or starts a
 * new one (closing any that was left half done and giving new questions), or
 * refuses when they have used all their goes.
 */
export async function beginAttempt(candidate: Candidate, pack: AssessmentPack, stage: StageKey, nowMs: number = Date.now()): Promise<BeginResult> {
  const all = db.getStageAttempts(candidate.school_id, candidate.id, stage)
    .map((a) => (a.status === 'open' ? { ...a, last_seen_at: seenAt(a) } : a));
  const allowed = MAX_ATTEMPTS + (candidate.extra_attempts?.[stage] ?? 0);
  const decision = decideAttempt(all, nowMs, allowed);

  if (decision.kind === 'blocked') return { ok: false, reason: 'blocked', used: decision.used, allowed };

  if (decision.kind === 'resume') {
    recordPing(decision.attempt, nowMs);
    return { ok: true, attempt: decision.attempt, resumed: true, allowed, content: contentFor(candidate, pack, decision.attempt) };
  }

  // A new go. Close the ones left behind and say so in the record.
  for (const old of decision.abandon) {
    db.saveStageAttempt({ ...old, status: 'abandoned', ended_at: new Date(nowMs).toISOString() });
    lastSeen.delete(old.id);
    db.addProctoringEvent(createProctoringEvent(
      candidate.school_id, candidate.id, stage, 'STAGE_RESTARTED',
      `Left this stage unfinished (go ${old.number}, away ${sinceText(old.last_seen_at, nowMs)}) and started again with new questions (go ${decision.number}).`
    ));
  }

  const attempt: StageAttempt = {
    id: `att_${nowMs}_${Math.random().toString(36).slice(2, 7)}`,
    school_id: candidate.school_id,
    candidate_id: candidate.id,
    stage_key: stage,
    number: decision.number,
    status: 'open',
    started_at: new Date(nowMs).toISOString(),
    last_seen_at: new Date(nowMs).toISOString(),
  };

  if (stage === 'written_theory') {
    const subject = normalizeSubject(candidate.applied_subject);
    // A school that wrote its own questions: everyone takes those, saved with this go so marking never drifts.
    const legacy = usesOwnQuestions(pack) ? null : decision.number === 1 && candidate.test_set && candidate.test_set.subject === subject ? candidate.test_set.ids : null;
    if (usesOwnQuestions(pack)) {
      attempt.own_questions = presentOwnTest(pack.mcqs, candidate.id, decision.number);
    } else if (legacy) {
      attempt.test_ids = legacy;
    } else {
      const seen = all.flatMap((a) => a.test_ids ?? []);
      const drawn = drawTest({
        subject, grades: gradesOf(candidate), candidateId: candidate.id,
        state: db.getBankState(), attempt: decision.number, seen,
      });
      if (drawn.ok) {
        attempt.test_ids = drawn.ids;
        db.recordBankUse(drawn.ids);
        db.updateCandidate(candidate.school_id, candidate.id, { test_set: { subject, ids: drawn.ids, drawn_at: new Date(nowMs).toISOString() } });
      }
    }
  }

  const kind = TASK_KIND[stage];
  const original = schoolPrompt(pack, stage);
  if (kind && decision.number > 1 && original) {
    const earlier = [original, ...all.map((a) => a.prompt).filter((p): p is string => !!p)];
    const fresh = await freshTask({
      kind, subject: candidate.applied_subject, segment: candidate.applied_segment,
      board: pack.board || 'CBSE', avoid: [...new Set(earlier)],
    });
    attempt.prompt = fresh ?? original;
  } else if (original) {
    attempt.prompt = original;
  }

  db.saveStageAttempt(attempt);
  lastSeen.set(attempt.id, { at: nowMs, saved: nowMs });
  return { ok: true, attempt, resumed: false, allowed, content: contentFor(candidate, pack, attempt) };
}

/** The go in progress for a stage, if there is one. */
export function openAttempt(schoolId: string, candidateId: string, stage: StageKey): StageAttempt | undefined {
  return db.getStageAttempts(schoolId, candidateId, stage)
    .filter((a) => a.status === 'open')
    .sort((a, b) => b.number - a.number)[0];
}

/** Marks the go as handed in. */
export function closeAttempt(attempt: StageAttempt, nowMs: number = Date.now()): void {
  db.saveStageAttempt({ ...attempt, status: 'submitted', ended_at: new Date(nowMs).toISOString() });
  lastSeen.delete(attempt.id);
}

export function isAttemptStage(stage: string): boolean {
  return (ATTEMPT_STAGES as string[]).includes(stage);
}
