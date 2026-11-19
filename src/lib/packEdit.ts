/**
 * Checks a school's hand edits to a written test before they are saved, so a
 * question with no right answer, or a blank prompt, can never reach a candidate.
 * Everything here is pure; saving is done by the route.
 */

import { MIN_OWN_QUESTIONS } from './ownTest';
import type { AssessmentPack } from './types';

type Mcq = AssessmentPack['mcqs'][number];

export type PackEdits = Partial<Pick<AssessmentPack,
  'title' | 'mcqs' | 'lesson_prompt' | 'lesson_rubric' | 'demo_prompt' | 'demo_rubric' | 'scenario_prompt' | 'scenario_rubric' | 'use_own_questions'>>;

export type EditResult = { ok: true; updates: PackEdits } | { ok: false; error: string };

export const MAX_QUESTIONS = 80;

const line = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const block = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');

function cleanQuestion(input: unknown, index: number, taken: Set<string>): { ok: true; q: Mcq } | { ok: false; error: string } {
  const n = index + 1;
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const text = block(raw.question_text, 800);
  if (!text) return { ok: false, error: `Question ${n} has no question text.` };

  const options = (Array.isArray(raw.options) ? raw.options : []).map((o) => line(o, 300)).filter(Boolean);
  if (options.length < 2) return { ok: false, error: `Question ${n} needs at least two answers.` };
  if (options.length > 6) return { ok: false, error: `Question ${n} has more than six answers.` };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) {
    return { ok: false, error: `Question ${n} has two answers that are the same.` };
  }

  const correct = line(raw.correct_option, 300);
  const match = options.find((o) => o.toLowerCase() === correct.toLowerCase());
  if (!match) return { ok: false, error: `Question ${n}: choose which answer is correct.` };

  let id = line(raw.id, 80);
  if (!id || taken.has(id)) id = `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  taken.add(id);

  const explanation = block(raw.explanation, 800);
  return {
    ok: true,
    q: {
      id,
      question_text: text,
      options,
      correct_option: match,
      ...(explanation ? { explanation } : {}),
      category: raw.category === 'pedagogy' ? 'pedagogy' : 'subject',
    },
  };
}

/** Only the fields below can be changed; anything else in the request is ignored. */
export function cleanPackEdits(input: unknown): EditResult {
  const body = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const updates: PackEdits = {};

  if (body.title !== undefined) {
    const title = line(body.title, 120);
    if (!title) return { ok: false, error: 'Give the test a title.' };
    updates.title = title;
  }

  if (body.mcqs !== undefined) {
    if (!Array.isArray(body.mcqs)) return { ok: false, error: 'The questions were not in the right form.' };
    if (body.mcqs.length > MAX_QUESTIONS) return { ok: false, error: `A test can have at most ${MAX_QUESTIONS} questions.` };
    const taken = new Set<string>();
    const mcqs: Mcq[] = [];
    for (let i = 0; i < body.mcqs.length; i++) {
      const r = cleanQuestion(body.mcqs[i], i, taken);
      if (!r.ok) return r;
      mcqs.push(r.q);
    }
    updates.mcqs = mcqs;
  }

  for (const key of ['lesson_prompt', 'lesson_rubric', 'demo_prompt', 'demo_rubric', 'scenario_prompt', 'scenario_rubric'] as const) {
    if (body[key] === undefined) continue;
    const text = block(body[key], 4000);
    if (!text) return { ok: false, error: 'The task and the scoring guide cannot be left empty.' };
    updates[key] = text;
  }

  if (body.use_own_questions !== undefined) {
    if (typeof body.use_own_questions !== 'boolean') return { ok: false, error: 'Choose where the questions come from.' };
    updates.use_own_questions = body.use_own_questions;
  }

  return { ok: true, updates };
}

/** Whether the test as it will be saved can be given to candidates as its own. */
export function ownQuestionsProblem(pack: Pick<AssessmentPack, 'use_own_questions' | 'mcqs'>): string | null {
  if (!pack.use_own_questions) return null;
  const count = pack.mcqs?.length ?? 0;
  return count >= MIN_OWN_QUESTIONS ? null : `To use this test's own questions it needs at least ${MIN_OWN_QUESTIONS}. It has ${count}.`;
}

/** Whether two lists of questions say the same thing, ignoring key order and fields left blank. */
export function sameQuestions(a: AssessmentPack['mcqs'] | undefined, b: AssessmentPack['mcqs'] | undefined): boolean {
  const flat = (list: AssessmentPack['mcqs'] | undefined) =>
    JSON.stringify((list ?? []).map((q) => [q.id, q.question_text, q.options, q.correct_option, q.explanation ?? '', q.category === 'pedagogy' ? 'pedagogy' : 'subject']));
  return flat(a) === flat(b);
}
