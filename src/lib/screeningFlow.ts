/**
 * The school's rules for what happens after an AI screening call: which
 * result sends the test link on its own, which waits for HR, which is only
 * flagged, and what to do when nobody picks up. Pure: no database, no
 * messages. screeningCallService.ts carries the decisions out.
 */

import type { ScreeningAction, ScreeningCheck, ScreeningCall, ScreeningRules } from './types';

export const DEFAULT_RULES: ScreeningRules = {
  enabled: false,
  on_proceed: 'send_link',
  on_maybe: 'hold',
  on_not_suitable: 'flag',
  retries: 2,
  retry_gap_hours: 4,
  after_no_answer: 'flag',
  window_start_hour: 9,
  window_end_hour: 19,
};

export const MAX_RETRIES = 5;

export type Outcome = 'proceed' | 'maybe' | 'not_suitable';
const RANK: Record<Outcome, number> = { proceed: 0, maybe: 1, not_suitable: 2 };

/** The school's rules with anything missing or out of range put right. */
export function normalizeRules(input: unknown): ScreeningRules {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const action = (v: unknown, fallback: ScreeningAction): ScreeningAction => (v === 'send_link' || v === 'hold' || v === 'flag' ? v : fallback);
  const int = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  const start = int(r.window_start_hour, DEFAULT_RULES.window_start_hour, 0, 23);
  let end = int(r.window_end_hour, DEFAULT_RULES.window_end_hour, 1, 24);
  if (end <= start) end = Math.min(24, start + 1);
  return {
    enabled: r.enabled === true,
    on_proceed: action(r.on_proceed, DEFAULT_RULES.on_proceed),
    on_maybe: action(r.on_maybe, DEFAULT_RULES.on_maybe),
    on_not_suitable: action(r.on_not_suitable, DEFAULT_RULES.on_not_suitable),
    retries: int(r.retries, DEFAULT_RULES.retries, 0, MAX_RETRIES),
    retry_gap_hours: int(r.retry_gap_hours, DEFAULT_RULES.retry_gap_hours, 1, 72),
    after_no_answer: r.after_no_answer === 'send_link' ? 'send_link' : 'flag',
    window_start_hour: start,
    window_end_hour: end,
  };
}

/**
 * The overall result of a call: the AI's recommendation, made no better by the
 * school's must-haves. A must-have not met makes it not suitable; one the AI
 * could not tell makes it at best "maybe".
 */
export function outcomeOf(recommendation: Outcome | undefined, checks: ScreeningCheck[] | undefined): Outcome {
  let outcome: Outcome = recommendation ?? 'maybe';
  for (const c of checks ?? []) {
    const worst: Outcome = c.result === 'not_met' ? 'not_suitable' : c.result === 'unclear' ? 'maybe' : 'proceed';
    if (RANK[worst] > RANK[outcome]) outcome = worst;
  }
  return outcome;
}

export function actionFor(rules: ScreeningRules, outcome: Outcome): ScreeningAction {
  return outcome === 'proceed' ? rules.on_proceed : outcome === 'maybe' ? rules.on_maybe : rules.on_not_suitable;
}

export type NoAnswerPlan =
  | { kind: 'retry'; at: Date }
  | { kind: 'give_up'; then: 'send_link' | 'flag' };

/** Hours in India time (UTC+5:30), as a whole number from 0 to 23 with the fraction kept. */
function istHour(d: Date): number {
  const ist = new Date(d.getTime() + 5.5 * 3_600_000);
  return ist.getUTCHours() + ist.getUTCMinutes() / 60;
}

/** The first moment at or after `from` that falls inside the calling window. */
export function nextInWindow(from: Date, rules: Pick<ScreeningRules, 'window_start_hour' | 'window_end_hour'>): Date {
  const h = istHour(from);
  if (h >= rules.window_start_hour && h < rules.window_end_hour) return from;
  const hoursToStart = h < rules.window_start_hour ? rules.window_start_hour - h : 24 - h + rules.window_start_hour;
  return new Date(from.getTime() + hoursToStart * 3_600_000);
}

/** Whether to ring again or stop trying, given the call that just went unanswered. */
export function planAfterNoAnswer(rules: ScreeningRules, call: Pick<ScreeningCall, 'attempt'>, now: Date = new Date()): NoAnswerPlan {
  const attempt = call.attempt ?? 1;
  if (attempt > rules.retries) return { kind: 'give_up', then: rules.after_no_answer };
  return { kind: 'retry', at: nextInWindow(new Date(now.getTime() + rules.retry_gap_hours * 3_600_000), rules) };
}

/** Normalised must-haves, one per question, empty where none. */
export function cleanRequirements(questions: string[], input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  return questions.map((_, i) => (typeof list[i] === 'string' ? list[i].replace(/\s+/g, ' ').trim().slice(0, 200) : ''));
}
