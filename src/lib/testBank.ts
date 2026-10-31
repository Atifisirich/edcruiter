/**
 * The platform question bank, and the way each candidate gets their own test
 * from it.
 *
 * A fixed test is a leak waiting to happen: every candidate at a school sees
 * the same thirty questions, so one person can pass the answers to the rest.
 * Here every candidate is given a different random draw from a much larger
 * pool, spread across the topics, with the question order and the order of the
 * answer options shuffled for them. Questions that have been used least are
 * preferred, so the whole pool wears evenly, and a question can be retired the
 * moment it is thought to have leaked.
 *
 * The questions live in files in the repository (src/lib/bank), so every
 * change is reviewed like code. What changes while the site runs (how often
 * each question was used, which are retired) is kept in the database.
 * Everything in this file is pure; the database is touched in candidateTest.ts.
 */

import biology from './bank/biology.json';
import chemistry from './bank/chemistry.json';
import computerScience from './bank/computer-science.json';
import english from './bank/english.json';
import environmentalStudies from './bank/environmental-studies.json';
import generalScience from './bank/general-science.json';
import hindi from './bank/hindi.json';
import mathematics from './bank/mathematics.json';
import pedagogy from './bank/pedagogy.json';
import physics from './bank/physics.json';
import socialStudies from './bank/social-studies.json';
import { cleanGrades } from './grades';

export interface BankQuestion {
  id: string;
  /** Grade ids from grades.ts, or "*" for every grade. */
  g: string[];
  /** Topic, used to spread a test across the syllabus. */
  t: string;
  /** s = subject knowledge, p = teaching practice. */
  k: 's' | 'p';
  q: string;
  /** The correct answer. */
  a: string;
  /** Three wrong answers. */
  w: string[];
  e?: string;
}

/** One question as a candidate takes it, with the answer key for marking. */
export interface DrawnQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_option: string;
  explanation?: string;
  category: 'subject' | 'pedagogy';
}

export interface BankState {
  /** How many candidates have been given each question. */
  exposures: Record<string, number>;
  /** Questions taken out of use. */
  retired: string[];
}

export const SUBJECT_QUESTIONS = 25;
export const PEDAGOGY_QUESTIONS = 5;

/** Subjects the bank has questions for, by the name subjectMatch.normalizeSubject gives them. */
export const SUBJECT_BANKS: Record<string, BankQuestion[]> = {
  biology: biology as BankQuestion[],
  chemistry: chemistry as BankQuestion[],
  'computer science': computerScience as BankQuestion[],
  english: english as BankQuestion[],
  'environmental studies': environmentalStudies as BankQuestion[],
  'general science': generalScience as BankQuestion[],
  hindi: hindi as BankQuestion[],
  mathematics: mathematics as BankQuestion[],
  physics: physics as BankQuestion[],
  'social studies': socialStudies as BankQuestion[],
};
export const PEDAGOGY_BANK: BankQuestion[] = pedagogy as BankQuestion[];

export function emptyBankState(): BankState {
  return { exposures: {}, retired: [] };
}

// --- A small seeded random generator, so a draw can be repeated exactly. ---

function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seededRandom(seed: string): () => number {
  let a = hash32(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function forGrades(q: BankQuestion, grades: string[]): boolean {
  if (q.g.includes('*') || grades.length === 0) return true;
  return q.g.some((g) => grades.includes(g));
}

/** Questions that may be used now: right grades, not retired. */
export function poolFor(bank: BankQuestion[], grades: string[], state: BankState): BankQuestion[] {
  const retired = new Set(state.retired);
  const wanted = cleanGrades(grades);
  return bank.filter((q) => !retired.has(q.id) && forGrades(q, wanted));
}

/** Takes `count` questions, rotating through the topics and preferring those used least. */
function pick(pool: BankQuestion[], count: number, state: BankState, random: () => number): BankQuestion[] {
  const byTopic = new Map<string, BankQuestion[]>();
  for (const q of shuffle(pool, random)) {
    const list = byTopic.get(q.t) ?? [];
    list.push(q);
    byTopic.set(q.t, list);
  }
  // Within a topic, least used first; the shuffle above breaks ties differently for each candidate.
  const queues = shuffle([...byTopic.values()], random).map((list) =>
    [...list].sort((x, y) => (state.exposures[x.id] ?? 0) - (state.exposures[y.id] ?? 0))
  );
  const chosen: BankQuestion[] = [];
  while (chosen.length < count && queues.some((q) => q.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) chosen.push(next);
      if (chosen.length >= count) break;
    }
  }
  return chosen;
}

/** The question as this candidate sees it: their own option order. Repeatable from the candidate and question ids alone. */
export function present(q: BankQuestion, candidateId: string): DrawnQuestion {
  const options = shuffle([q.a, ...q.w], seededRandom(`${candidateId}|${q.id}`));
  return {
    id: q.id,
    question_text: q.q,
    options,
    correct_option: q.a,
    explanation: q.e,
    category: q.k === 'p' ? 'pedagogy' : 'subject',
  };
}

export type DrawResult =
  | { ok: true; questions: DrawnQuestion[]; ids: string[] }
  | { ok: false; reason: 'no_bank' | 'pool_too_small'; poolSize: number };

/**
 * Draws a candidate's test. Fails (so the caller can fall back to the school's
 * own written test) when the bank does not hold enough questions for this
 * subject and these grades.
 */
export function drawTest(input: {
  subject: string;
  grades: string[];
  candidateId: string;
  state: BankState;
  subjectCount?: number;
  pedagogyCount?: number;
}): DrawResult {
  const bank = SUBJECT_BANKS[input.subject];
  if (!bank) return { ok: false, reason: 'no_bank', poolSize: 0 };

  const subjectCount = input.subjectCount ?? SUBJECT_QUESTIONS;
  const pedagogyCount = input.pedagogyCount ?? PEDAGOGY_QUESTIONS;
  const subjectPool = poolFor(bank, input.grades, input.state);
  const pedagogyPool = poolFor(PEDAGOGY_BANK, input.grades, input.state);
  if (subjectPool.length < subjectCount || pedagogyPool.length < pedagogyCount) {
    return { ok: false, reason: 'pool_too_small', poolSize: subjectPool.length };
  }

  const random = seededRandom(`${input.candidateId}|${input.subject}|${[...input.grades].sort().join(',')}`);
  const subjectPick = pick(subjectPool, subjectCount, input.state, random);
  const pedagogyPick = pick(pedagogyPool, pedagogyCount, input.state, random);
  // Questions are mixed together, so the test does not run in topic order or put teaching questions last.
  const ordered = shuffle([...subjectPick, ...pedagogyPick], random);

  return { ok: true, questions: ordered.map((q) => present(q, input.candidateId)), ids: ordered.map((q) => q.id) };
}

/** Rebuilds a test already given to a candidate, from the question ids saved for them. */
export function resolveTest(ids: string[], candidateId: string): DrawnQuestion[] {
  const all = new Map<string, BankQuestion>();
  for (const q of PEDAGOGY_BANK) all.set(q.id, q);
  for (const bank of Object.values(SUBJECT_BANKS)) for (const q of bank) all.set(q.id, q);
  return ids.map((id) => all.get(id)).filter((q): q is BankQuestion => !!q).map((q) => present(q, candidateId));
}

/** Problems in a bank file, in plain words. Used by the tests that guard future additions. */
export function bankProblems(bank: BankQuestion[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const q of bank) {
    const where = q.id || '(no id)';
    if (!q.id || seen.has(q.id)) problems.push(`${where}: missing or repeated id`);
    seen.add(q.id);
    if (!q.q || q.q.trim().length < 15) problems.push(`${where}: question text too short`);
    if (!q.a || !Array.isArray(q.w) || q.w.length !== 3) problems.push(`${where}: needs one correct answer and three wrong ones`);
    else {
      const all = [q.a, ...q.w].map((o) => o.trim().toLowerCase());
      if (new Set(all).size !== 4) problems.push(`${where}: two options are the same`);
      if (all.some((o) => !o)) problems.push(`${where}: an option is empty`);
      if (/all of the above|none of the above/i.test(all.join('|'))) problems.push(`${where}: uses "all/none of the above"`);
    }
    if (!Array.isArray(q.g) || q.g.length === 0 || (!q.g.includes('*') && cleanGrades(q.g).length !== q.g.length)) problems.push(`${where}: grades are not valid`);
    if (!q.t) problems.push(`${where}: no topic`);
    if (q.k !== 's' && q.k !== 'p') problems.push(`${where}: kind must be s or p`);
  }
  return problems;
}
