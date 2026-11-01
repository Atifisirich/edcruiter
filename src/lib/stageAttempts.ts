/**
 * Each stage is taken on its own, in the candidate's own time. A go at a stage
 * is an "attempt". If the page stays open (or is refreshed within a few minutes)
 * the same attempt carries on with the same questions. If the candidate walks
 * away half way and comes back later, that attempt is closed as abandoned and
 * the next one is given different questions, so having seen the paper once is
 * no help the second time.
 */

import type { StageAttempt, StageKey } from './types';

/** The stages that are taken as a go with a start and an end. Stage 1 (details and CV) is a form. */
export const ATTEMPT_STAGES: StageKey[] = [
  'written_theory',
  'micro_teaching_demo',
  'situational_scenario',
  'hr_policy_briefing',
];

/** All five, in the order they must be taken. */
export const STAGE_SEQUENCE: StageKey[] = ['identity_verification', ...ATTEMPT_STAGES];

/** Goes allowed at each stage before the school has to allow another. */
export const MAX_ATTEMPTS = 3;

/** A page that has said it is open within this long ago is still the same go (a refresh, a dropped connection). */
export const RESUME_WINDOW_MS = 3 * 60_000;

export type AttemptDecision =
  | { kind: 'resume'; attempt: StageAttempt }
  | { kind: 'new'; number: number; abandon: StageAttempt[] }
  | { kind: 'blocked'; used: number; allowed: number };

/**
 * What to do when a candidate opens a stage: carry on with the go in progress,
 * start a fresh one (closing any that was left), or stop because they have used
 * all their goes.
 */
export function decideAttempt(attempts: StageAttempt[], nowMs: number, allowed: number = MAX_ATTEMPTS): AttemptDecision {
  const open = attempts.filter((a) => a.status === 'open').sort((a, b) => b.number - a.number);
  const latest = open[0];
  if (latest && nowMs - Date.parse(latest.last_seen_at) <= RESUME_WINDOW_MS) {
    return { kind: 'resume', attempt: latest };
  }
  const highest = attempts.reduce((n, a) => Math.max(n, a.number), 0);
  const number = highest + 1;
  if (number > allowed) return { kind: 'blocked', used: highest, allowed };
  return { kind: 'new', number, abandon: open };
}

/** The stage before this one, which must be finished first. Null for stage 1. */
export function stageBefore(stage: StageKey): StageKey | null {
  const i = STAGE_SEQUENCE.indexOf(stage);
  return i > 0 ? STAGE_SEQUENCE[i - 1] : null;
}

/** The first stage in the sequence that is not finished, or null when all five are. */
export function nextStageToTake(doneKeys: string[]): StageKey | null {
  return STAGE_SEQUENCE.find((k) => !doneKeys.includes(k)) ?? null;
}

/** Whether every stage before this one is finished. */
export function canStart(stage: StageKey, doneKeys: string[]): boolean {
  const i = STAGE_SEQUENCE.indexOf(stage);
  if (i < 0) return false;
  return STAGE_SEQUENCE.slice(0, i).every((k) => doneKeys.includes(k));
}

/** "14 minutes" or "2 hours", for the note a reviewer reads. */
export function sinceText(fromIso: string, toMs: number): string {
  const minutes = Math.max(0, Math.round((toMs - Date.parse(fromIso)) / 60_000));
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hours` : `${Math.round(hours / 24)} days`;
}
