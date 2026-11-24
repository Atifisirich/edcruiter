/**
 * What a reviewer is asked to do in a round, and how it is kept.
 *
 * HR gives a shortlisted teacher to a reviewer (an allocation). The reviewer
 * interviews them, rates them on the round's rubric, says approve or do not
 * approve, and writes their opinion. That is a report card: it never moves the
 * teacher on or stops them. HR reads it and decides (hiringDecision.ts).
 */

import { accessOf, isAdmin } from './permissions';
import type { Candidate, ReviewRound, RoundReview, RubricItem, ScheduledInterview, User } from './types';

export const MAX_STARS = 5;
export const MIN_OPINION = 10;
export const MAX_RUBRIC_ITEMS = 10;

const item = (key: string, label: string): RubricItem => ({ key, label });

/** The ready-made rubric for each of the standard rounds. A school can change them in Settings. */
export const DEFAULT_RUBRICS: Record<string, RubricItem[]> = {
  subject_lead: [
    item('subject_knowledge', 'Subject knowledge'),
    item('teaching_method', 'Teaching method and lesson planning'),
    item('classroom', 'Classroom management'),
    item('communication', 'Communication and clarity'),
    item('cv_check', 'Their CV matches what they told you'),
  ],
  principal: [
    item('values', 'Values and professionalism'),
    item('handling', 'Handling students, parents and difficult situations'),
    item('school_fit', 'Fit with the school’s culture'),
    item('commitment', 'Commitment and stability'),
    item('communication', 'Communication'),
  ],
  management: [
    item('overall_fit', 'Overall fit for the role'),
    item('growth', 'Growth and long-term potential'),
    item('expectations', 'Salary and notice period expectations'),
    item('integrity', 'Honesty and integrity'),
    item('vision', 'Alignment with the school’s vision'),
  ],
};

/** For a round the school made up and gave no rubric. */
export const GENERIC_RUBRIC: RubricItem[] = [
  item('knowledge', 'Knowledge for the role'),
  item('communication', 'Communication'),
  item('professionalism', 'Professionalism'),
  item('fit', 'Fit with the school'),
];

/** What this round's reviewer rates: the school's own list, else the ready-made one. */
export function rubricFor(round: Pick<ReviewRound, 'id' | 'rubric'> | null | undefined): RubricItem[] {
  if (round?.rubric?.length) return round.rubric;
  return (round && DEFAULT_RUBRICS[round.id]) || GENERIC_RUBRIC;
}

function cleanLabel(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
}

/** Checks the admin's edited rubric before it is saved. Absent or empty means "use the ready-made one". */
export function parseRubric(input: unknown): { ok: true; rubric: RubricItem[] | undefined } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, rubric: undefined };
  if (!Array.isArray(input)) return { ok: false, error: 'The rating list was not in the right form.' };
  if (input.length === 0) return { ok: true, rubric: undefined };
  if (input.length > MAX_RUBRIC_ITEMS) return { ok: false, error: `A round can have up to ${MAX_RUBRIC_ITEMS} things to rate.` };
  const out: RubricItem[] = [];
  const seen = new Set<string>();
  for (const raw of input as Record<string, unknown>[]) {
    const label = cleanLabel(raw?.label);
    if (label.length < 2 || label.length > 80) return { ok: false, error: 'Each thing to rate needs 2 to 80 characters.' };
    if (/[<>]/.test(label)) return { ok: false, error: 'Things to rate cannot contain < or >.' };
    if (seen.has(label.toLowerCase())) return { ok: false, error: `"${label}" is in the list twice.` };
    seen.add(label.toLowerCase());
    let key = typeof raw?.key === 'string' && /^[a-z0-9_]{1,40}$/.test(raw.key) ? raw.key : label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || `item_${out.length + 1}`;
    if (out.some((o) => o.key === key)) key = `${key}_${out.length + 1}`;
    out.push({ key, label });
  }
  return { ok: true, rubric: out };
}

export interface ReviewInput {
  recommendation?: unknown;
  ratings?: unknown;
  opinion?: unknown;
}

/** Checks a reviewer's report card against the round's rubric. Every item must be rated. */
export function buildReview(
  input: ReviewInput,
  rubric: RubricItem[],
  by: { id: string; name: string },
  nowIso: string = new Date().toISOString()
): { ok: true; review: RoundReview } | { ok: false; error: string } {
  if (input.recommendation !== 'approve' && input.recommendation !== 'not_approve') {
    return { ok: false, error: 'Choose Approve or Do not approve.' };
  }
  const given = new Map<string, number>();
  if (Array.isArray(input.ratings)) {
    for (const r of input.ratings as Record<string, unknown>[]) {
      const score = Number(r?.score);
      if (typeof r?.key === 'string' && Number.isInteger(score) && score >= 1 && score <= MAX_STARS) given.set(r.key, score);
    }
  }
  const missing = rubric.filter((r) => !given.has(r.key));
  if (missing.length) {
    return { ok: false, error: missing.length === 1 ? `Rate "${missing[0].label}" from 1 to ${MAX_STARS} stars.` : `Rate every item from 1 to ${MAX_STARS} stars. ${missing.length} are still blank.` };
  }
  const opinion = typeof input.opinion === 'string' ? input.opinion.replace(/\r\n/g, '\n').trim().slice(0, 2000) : '';
  if (opinion.length < MIN_OPINION) return { ok: false, error: 'Write your opinion of this teacher, in a sentence or two. Only your school sees it.' };

  const ratings = rubric.map((r) => ({ key: r.key, label: r.label, score: given.get(r.key) as number }));
  const average = Math.round((ratings.reduce((n, r) => n + r.score, 0) / (ratings.length * MAX_STARS)) * 100);
  return {
    ok: true,
    review: { reviewer_id: by.id, reviewer_name: by.name, recommendation: input.recommendation, ratings, average, opinion, submitted_at: nowIso },
  };
}

/** Where one round stands for one teacher, for the cards. */
export type RoundStage = 'not_allocated' | 'waiting_review' | 'reviewed' | 'passed' | 'stopped';

export function roundStage(c: Pick<Candidate, 'round_assignments' | 'round_reviews' | 'round_results' | 'rm_clearance' | 'ih_clearance' | 'coo_clearance'>, roundId: string, result?: { status: 'cleared' | 'rejected' }): RoundStage {
  if (result?.status === 'cleared') return 'passed';
  if (result?.status === 'rejected') return 'stopped';
  if (c.round_reviews?.[roundId]) return 'reviewed';
  if (c.round_assignments?.[roundId]) return 'waiting_review';
  return 'not_allocated';
}

/**
 * May this person write the report card for this teacher in this round? The
 * reviewer HR allocated them to (or booked them with), when they also hold the
 * round's role. The school admin may always, on a reviewer's behalf.
 */
export function mayReview(
  user: Pick<User, 'id' | 'role' | 'role_id'>,
  candidate: Pick<Candidate, 'round_assignments'>,
  round: ReviewRound,
  interviews: Pick<ScheduledInterview, 'assigned_user_id' | 'round' | 'status'>[] = []
): boolean {
  if (isAdmin(user.role)) return true;
  if (accessOf(user.role) !== 'reviewer') return false;
  if (!round.role_ids.includes(user.role_id ?? user.role)) return false;
  if (candidate.round_assignments?.[round.id]?.user_id === user.id) return true;
  return interviews.some((i) => i.assigned_user_id === user.id && i.round === round.id && i.status === 'scheduled');
}

/**
 * Has this round's review been given, where one was asked for? HR may pass or
 * stop a teacher no one was allocated to (older teachers part-way through the
 * pipeline), but not one a reviewer has yet to rate.
 */
export function reviewStillOwed(c: Pick<Candidate, 'round_assignments' | 'round_reviews'>, roundId: string): boolean {
  return !!c.round_assignments?.[roundId] && !c.round_reviews?.[roundId];
}
