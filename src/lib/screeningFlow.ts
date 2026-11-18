/**
 * The school's rules for what happens around an AI screening call: which
 * questions each kind of post is asked, which result sends the test link on
 * its own, which waits for HR, which suggests a decline for HR to approve,
 * and what to do when nobody picks up or the candidate asks to be called
 * later. Pure: no database, no messages, safe to use in the browser.
 * screeningCallService.ts carries the decisions out.
 */

import type {
  Candidate, QuestionImportance, ScreeningAction, ScreeningCall, ScreeningCheck, ScreeningGroup,
  ScreeningLanguage, ScreeningQuestionSet, ScreeningRules,
} from './types';
import { levelName } from './grades';

export const DEFAULT_RULES: ScreeningRules = {
  enabled: false,
  on_proceed: 'send_link',
  on_maybe: 'hold',
  on_not_suitable: 'suggest_decline',
  on_not_interested: 'withdraw',
  hold_days: 2,
  after_hold: 'remind',
  retries: 2,
  retry_gap_hours: 4,
  after_no_answer: 'flag',
  after_failed: 'flag',
  missed_call_message: true,
  max_callbacks: 2,
  window_start_hour: 9,
  window_end_hour: 19,
  skip_sundays: true,
};

export const MAX_RETRIES = 5;
export const MAX_CALLBACKS = 3;
export const HOLD_DAY_CHOICES = [0, 1, 2, 3, 5, 7];

export type Outcome = 'proceed' | 'maybe' | 'not_suitable';
const RANK: Record<Outcome, number> = { proceed: 0, maybe: 1, not_suitable: 2 };
const ACTIONS: ScreeningAction[] = ['send_link', 'hold', 'flag', 'suggest_decline'];

const int = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

/** The school's rules with anything missing or out of range put right. */
export function normalizeRules(input: unknown): ScreeningRules {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const action = (v: unknown, fallback: ScreeningAction): ScreeningAction => (ACTIONS.includes(v as ScreeningAction) ? v as ScreeningAction : fallback);
  const start = int(r.window_start_hour, DEFAULT_RULES.window_start_hour, 0, 23);
  let end = int(r.window_end_hour, DEFAULT_RULES.window_end_hour, 1, 24);
  if (end <= start) end = Math.min(24, start + 1);
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    enabled: r.enabled === true,
    on_proceed: action(r.on_proceed, DEFAULT_RULES.on_proceed),
    on_maybe: action(r.on_maybe, DEFAULT_RULES.on_maybe),
    // Older settings had no decline choice; their "flag" stays a flag.
    on_not_suitable: action(r.on_not_suitable, DEFAULT_RULES.on_not_suitable),
    on_not_interested: r.on_not_interested === 'as_not_suitable' ? 'as_not_suitable' : 'withdraw',
    hold_days: HOLD_DAY_CHOICES.includes(Number(r.hold_days)) ? Number(r.hold_days) : DEFAULT_RULES.hold_days,
    after_hold: r.after_hold === 'send_link' ? 'send_link' : 'remind',
    retries: int(r.retries, DEFAULT_RULES.retries, 0, MAX_RETRIES),
    retry_gap_hours: int(r.retry_gap_hours, DEFAULT_RULES.retry_gap_hours, 1, 72),
    after_no_answer: r.after_no_answer === 'send_link' ? 'send_link' : 'flag',
    after_failed: r.after_failed === 'send_link' ? 'send_link' : 'flag',
    missed_call_message: bool(r.missed_call_message, DEFAULT_RULES.missed_call_message),
    max_callbacks: int(r.max_callbacks, DEFAULT_RULES.max_callbacks, 0, MAX_CALLBACKS),
    window_start_hour: start,
    window_end_hour: end,
    skip_sundays: bool(r.skip_sundays, DEFAULT_RULES.skip_sundays),
  };
}

// --- Kinds of post and their questions --------------------------------------

export const GROUPS: { key: ScreeningGroup; name: string; help: string }[] = [
  { key: 'pre_primary', name: 'Pre-primary', help: 'Nursery, LKG, UKG' },
  { key: 'primary', name: 'Primary', help: 'Grades 1–5' },
  { key: 'middle', name: 'Middle school', help: 'Grades 6–8' },
  { key: 'secondary', name: 'Secondary', help: 'Grades 9–10' },
  { key: 'senior_secondary', name: 'Senior secondary', help: 'Grades 11–12' },
  { key: 'non_teaching', name: 'Non-teaching', help: 'Office, accounts, transport and other staff' },
];
const GROUP_KEYS = GROUPS.map((g) => g.key);
export const groupName = (g: ScreeningGroup | undefined) => GROUPS.find((x) => x.key === g)?.name ?? 'Main questions';

/** The kind of post a candidate applied for, or null when it cannot be told (they get the main questions). */
export function groupOf(
  candidate: Pick<Candidate, 'applied_subject' | 'applied_segment' | 'applied_grades'>,
  nonTeachingRoles: string[] = []
): ScreeningGroup | null {
  const subject = (candidate.applied_subject || '').trim().toLowerCase();
  if (subject && nonTeachingRoles.some((r) => r.trim().toLowerCase() === subject)) return 'non_teaching';
  const level = candidate.applied_grades?.length ? levelName(candidate.applied_grades) : (candidate.applied_segment || '').trim();
  if (/^pre-?primary/i.test(level)) return 'pre_primary';
  if (/^primary/i.test(level)) return 'primary';
  if (/^middle/i.test(level)) return 'middle';
  if (/^senior/i.test(level)) return 'senior_secondary';
  if (/^secondary/i.test(level)) return 'secondary';
  return null;
}

type Q = [string, QuestionImportance, string];
const set = (qs: Q[]): ScreeningQuestionSet => ({ questions: qs.map((q) => q[0]), importance: qs.map((q) => q[1]), requirements: qs.map((q) => q[2]) });

/** Ready-made questions for each kind of post, written for Indian schools. A school copies one and changes it. */
export const STARTER_SETS: Record<ScreeningGroup, ScreeningQuestionSet> = {
  pre_primary: set([
    ['Are you still interested in this pre-primary teaching position?', 'ask', ''],
    ['Do you have NTT, Montessori, ECCE or a similar early-childhood training?', 'must', 'Has NTT, Montessori, ECCE or similar training, or a B.Ed'],
    ['How many years have you taught children aged three to six?', 'prefer', 'At least 1 year with children aged 3 to 6'],
    ['What is your notice period, and when could you join?', 'prefer', '30 days or less'],
    ['What is your current salary, and what salary do you expect?', 'ask', ''],
    ['Can you travel to our campus every day?', 'must', 'Can travel to the campus daily'],
  ]),
  primary: set([
    ['Are you still interested in this primary teaching position?', 'ask', ''],
    ['Do you have a B.Ed or D.El.Ed degree?', 'must', 'Has a B.Ed or D.El.Ed, or is finishing it this year'],
    ['How many years have you taught grades one to five, and which boards?', 'prefer', 'At least 1 year teaching grades 1 to 5'],
    ['What is your notice period, and when could you join?', 'prefer', '30 days or less'],
    ['What is your current salary, and what salary do you expect?', 'ask', ''],
    ['Can you travel to our campus every day?', 'must', 'Can travel to the campus daily'],
  ]),
  middle: set([
    ['Are you still interested in this teaching position?', 'ask', ''],
    ['Do you have a B.Ed degree, and a degree in the subject you teach?', 'must', 'Has a B.Ed and a degree in the subject'],
    ['How many years have you taught grades six to eight, and which boards?', 'prefer', 'At least 2 years teaching grades 6 to 8'],
    ['What is your notice period, and when could you join?', 'prefer', '30 days or less'],
    ['What is your current salary, and what salary do you expect?', 'ask', ''],
    ['Can you travel to our campus every day?', 'must', 'Can travel to the campus daily'],
  ]),
  secondary: set([
    ['Are you still interested in this teaching position?', 'ask', ''],
    ['Do you have a B.Ed degree, and a degree in the subject you teach?', 'must', 'Has a B.Ed and a degree in the subject'],
    ['Have you taught grade ten board classes? For how many years, and which board?', 'prefer', 'Has taught grade 10 board classes'],
    ['What is your notice period, and when could you join?', 'prefer', '60 days or less'],
    ['What is your current salary, and what salary do you expect?', 'ask', ''],
    ['Can you travel to our campus every day?', 'must', 'Can travel to the campus daily'],
  ]),
  senior_secondary: set([
    ['Are you still interested in this senior secondary teaching position?', 'ask', ''],
    ['Do you have a post-graduate degree in your subject, and a B.Ed?', 'must', 'Has a post-graduate degree in the subject and a B.Ed'],
    ['Have you taught grades eleven and twelve? For how many years, and which board?', 'prefer', 'At least 2 years teaching grades 11 and 12'],
    ['How did your students do in their last board exams?', 'ask', ''],
    ['What is your notice period, and when could you join?', 'prefer', '60 days or less'],
    ['What is your current salary, and what salary do you expect?', 'ask', ''],
  ]),
  non_teaching: set([
    ['Are you still interested in this position?', 'ask', ''],
    ['Which role are you applying for, and how many years have you done similar work?', 'prefer', 'At least 1 year of similar work'],
    ['Are you comfortable with computers, for example MS Office or Tally?', 'ask', ''],
    ['Our school works six days a week. Are the school timings fine for you?', 'must', 'Can work the school timings, six days a week'],
    ['What is your notice period, and when could you join?', 'prefer', '30 days or less'],
    ['What is your current salary, and what salary do you expect?', 'ask', ''],
  ]),
};

/** Normalised must-haves, one per question, empty where none. */
export function cleanRequirements(questions: string[], input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  return questions.map((_, i) => (typeof list[i] === 'string' ? list[i].replace(/\s+/g, ' ').trim().slice(0, 200) : ''));
}

/**
 * How much each question matters. A question with nothing written to look for
 * is always "just ask". Older settings had no importance: a question with a
 * requirement was a must-have.
 */
export function cleanImportance(requirements: string[], input: unknown): QuestionImportance[] {
  const list = Array.isArray(input) ? input : [];
  return requirements.map((r, i) => {
    if (!r) return 'ask';
    const v = list[i];
    return v === 'prefer' ? 'prefer' : v === 'ask' ? 'ask' : 'must';
  });
}

// --- Reading a call's result -------------------------------------------------

/**
 * The overall result of a call: the AI's recommendation, made no better by the
 * school's wishes. A must-have not met makes it not suitable, one the AI could
 * not tell makes it at best "maybe". A preference not met makes it at best
 * "maybe"; one the AI could not tell changes nothing.
 */
export function outcomeOf(recommendation: Outcome | undefined, checks: ScreeningCheck[] | undefined): Outcome {
  let outcome: Outcome = recommendation ?? 'maybe';
  for (const c of checks ?? []) {
    const must = c.importance !== 'prefer';
    const worst: Outcome = must
      ? (c.result === 'not_met' ? 'not_suitable' : c.result === 'unclear' ? 'maybe' : 'proceed')
      : (c.result === 'not_met' ? 'maybe' : 'proceed');
    if (RANK[worst] > RANK[outcome]) outcome = worst;
  }
  return outcome;
}

export function actionFor(rules: ScreeningRules, outcome: Outcome): ScreeningAction {
  return outcome === 'proceed' ? rules.on_proceed : outcome === 'maybe' ? rules.on_maybe : rules.on_not_suitable;
}

export const OUTCOME_LABEL: Record<Outcome, string> = { proceed: 'Good fit', maybe: 'Needs a look', not_suitable: 'Not suitable' };

// --- Time -------------------------------------------------------------------

const IST_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** The UTC time of the India-time midnight at or before `t`. */
function istMidnight(t: number): number {
  const s = t + IST_MS;
  return s - (((s % DAY_MS) + DAY_MS) % DAY_MS) - IST_MS;
}

/** India-time calendar date, such as "2026-11-18". */
export function istDate(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
}

/** India-time hour of the day, with the fraction kept. */
export function istHour(d: Date): number {
  return (d.getTime() - istMidnight(d.getTime())) / 3_600_000;
}

type WindowRules = Pick<ScreeningRules, 'window_start_hour' | 'window_end_hour'> & { skip_sundays?: boolean };

/** The first moment at or after `from` that falls inside the calling hours (and not on a Sunday, if the school skips them). */
export function nextInWindow(from: Date, rules: WindowRules): Date {
  let t = from.getTime();
  for (let i = 0; i < 10; i++) {
    const mid = istMidnight(t);
    const h = (t - mid) / 3_600_000;
    const sunday = new Date(mid + IST_MS).getUTCDay() === 0;
    if (rules.skip_sundays && sunday) { t = mid + DAY_MS + rules.window_start_hour * 3_600_000; continue; }
    if (h >= rules.window_start_hour && h < rules.window_end_hour) return t === from.getTime() ? from : new Date(t);
    t = h < rules.window_start_hour ? mid + rules.window_start_hour * 3_600_000 : mid + DAY_MS + rules.window_start_hour * 3_600_000;
  }
  return new Date(t);
}

export type NoAnswerPlan =
  | { kind: 'retry'; at: Date }
  | { kind: 'give_up'; then: 'send_link' | 'flag' };

/** Whether to ring again or stop trying, given the call that just went unanswered. */
export function planAfterNoAnswer(rules: ScreeningRules, call: Pick<ScreeningCall, 'attempt'>, now: Date = new Date()): NoAnswerPlan {
  const attempt = call.attempt ?? 1;
  if (attempt > rules.retries) return { kind: 'give_up', then: rules.after_no_answer };
  return { kind: 'retry', at: nextInWindow(new Date(now.getTime() + rules.retry_gap_hours * 3_600_000), rules) };
}

/**
 * When to ring back a candidate who asked for another time. The time they
 * asked for, if it is sensible (in the future, within a week), moved into the
 * calling hours; otherwise two hours from now, inside the calling hours.
 */
export function callbackTime(asked: string | undefined, rules: ScreeningRules, now: Date = new Date()): Date {
  const t = asked ? Date.parse(asked) : NaN;
  const ok = Number.isFinite(t) && t > now.getTime() + 10 * 60_000 && t < now.getTime() + 7 * DAY_MS;
  return nextInWindow(new Date(ok ? t : now.getTime() + 2 * 3_600_000), rules);
}

/** Whether the candidate may be called back once more. */
export function mayCallBack(rules: ScreeningRules, call: Pick<ScreeningCall, 'callback_count'>): boolean {
  return (call.callback_count ?? 0) < rules.max_callbacks;
}

/** The language the AI speaks: the school's choice, or for "auto" the first of English, Hindi, Telugu that the candidate gave. */
export function callLanguage(setting: ScreeningLanguage | undefined, candidateLanguages: string[] | undefined): 'English' | 'Hindi' | 'Telugu' {
  if (setting && setting !== 'auto') return setting;
  const langs = (candidateLanguages ?? []).map((l) => l.toLowerCase());
  if (langs.some((l) => l.includes('english'))) return 'English';
  if (langs.some((l) => l.includes('hindi'))) return 'Hindi';
  if (langs.some((l) => l.includes('telugu'))) return 'Telugu';
  return 'English';
}

/** The lower of the school's own monthly limit and the platform owner's, or 0 when neither is set. */
export function monthlyCapOf(schoolCap: number | undefined, ownerCap: number | undefined): number {
  const caps = [schoolCap, ownerCap].filter((c): c is number => typeof c === 'number' && c > 0);
  return caps.length ? Math.min(...caps) : 0;
}

// --- Presets and a plain-words reading of the rules ---------------------------

type PresetRules = Pick<ScreeningRules, 'on_proceed' | 'on_maybe' | 'on_not_suitable' | 'after_no_answer'>;
export interface RulePreset { key: string; name: string; help: string; rules: PresetRules }

/** Ready-made choices, so a school does not have to understand every setting to start. */
export const RULE_PRESETS: RulePreset[] = [
  {
    key: 'careful',
    name: 'Careful (recommended)',
    help: 'Good fits get the test link at once. Unsure ones wait for HR. For not suitable ones HR approves a polite decline.',
    rules: { on_proceed: 'send_link', on_maybe: 'hold', on_not_suitable: 'suggest_decline', after_no_answer: 'flag' },
  },
  {
    key: 'fast',
    name: 'Fast',
    help: 'Good fits and unsure ones both get the test link at once. If nobody answers, they still get the link. Declines still need HR.',
    rules: { on_proceed: 'send_link', on_maybe: 'send_link', on_not_suitable: 'suggest_decline', after_no_answer: 'send_link' },
  },
  {
    key: 'manual',
    name: 'HR decides everything',
    help: 'Nothing is sent on its own. HR sees every result and presses "Send the test link" for the ones they want.',
    rules: { on_proceed: 'hold', on_maybe: 'hold', on_not_suitable: 'flag', after_no_answer: 'flag' },
  },
];

/** The preset these rules match, if any. */
export function matchingPreset(rules: ScreeningRules): string | null {
  const hit = RULE_PRESETS.find((p) => (Object.keys(p.rules) as (keyof PresetRules)[]).every((k) => p.rules[k] === rules[k]));
  return hit?.key ?? null;
}

export function hourText(h: number): string {
  const h24 = h % 24;
  return `${h24 % 12 === 0 ? 12 : h24 % 12} ${h24 < 12 ? 'am' : 'pm'}`;
}

export const DOES: Record<ScreeningAction, string> = {
  send_link: 'the test link is sent to them right away (email, and WhatsApp if they agreed)',
  hold: 'HR sees a "Send the test link" button and decides',
  flag: 'nothing is sent; the candidate is flagged for HR to decide',
  suggest_decline: 'nothing is sent; HR sees a "Send the decline" button, and the polite decline goes out only when HR presses it',
};

/** What the rules mean, in plain sentences, for the school to read back before saving. */
export function describeRules(rules: ScreeningRules, musts: number): string[] {
  if (!rules.enabled) {
    return ['Nothing happens automatically. The AI call only writes up the answers; HR reads them and sends test links themselves.'];
  }
  const lines = [
    `Good fit (interested${musts ? ', and every must-have is met' : ''}): ${DOES[rules.on_proceed]}.`,
    `Needs a look (unsure${musts ? ', a preference is not met, or a must-have could not be confirmed' : ''}): ${DOES[rules.on_maybe]}.`,
    `Not suitable${musts ? ' (a must-have is clearly not met)' : ''}: ${DOES[rules.on_not_suitable]}.`,
    rules.on_not_interested === 'withdraw'
      ? 'If they say they are no longer interested, they are marked as withdrawn. Nothing is sent, and HR can reopen them.'
      : 'If they say they are no longer interested, it is treated as Not suitable.',
  ];
  if (rules.hold_days > 0) {
    lines.push(`If a result waits for HR more than ${rules.hold_days} ${rules.hold_days === 1 ? 'day' : 'days'}, ${rules.after_hold === 'send_link' ? 'the test link is sent anyway (for "Wait for HR" results; declines are only reminded)' : 'HR gets a reminder email'}.`);
  }
  const hours = `between ${hourText(rules.window_start_hour)} and ${hourText(rules.window_end_hour)} (India time${rules.skip_sundays ? ', not on Sundays' : ''})`;
  if (rules.retries === 0) {
    lines.push(`If they do not pick up: ${rules.after_no_answer === 'send_link' ? 'the test link is sent right away' : 'nothing is sent; HR is flagged'}. There are no retries.`);
  } else {
    lines.push(
      `If they do not pick up: the AI tries again up to ${rules.retries} ${rules.retries === 1 ? 'time' : 'times'}, ${rules.retry_gap_hours} ${rules.retry_gap_hours === 1 ? 'hour' : 'hours'} apart, ${hours}. If they still do not answer, ${rules.after_no_answer === 'send_link' ? 'the test link is sent anyway' : 'HR is flagged and nothing is sent'}.`
    );
  }
  if (rules.missed_call_message) lines.push('After a missed call, the candidate gets a message saying the school tried to reach them.');
  lines.push(rules.max_callbacks > 0
    ? `If they ask to be called later ("I am in class, call me after 4"), the AI rings them at that time, up to ${rules.max_callbacks} ${rules.max_callbacks === 1 ? 'time' : 'times'}.`
    : 'If they ask to be called later, HR is flagged to call them.');
  lines.push(`If the call cannot go through (for example a Do Not Disturb number): ${rules.after_failed === 'send_link' ? 'the test link is sent anyway' : 'HR is flagged'}.`);
  lines.push('A test link is never sent twice, and never to someone who has already started the test. A decline is never sent without HR.');
  return lines;
}

// --- "Try it": what would happen to one made-up call --------------------------

export interface TrialInput {
  pickup: 'answered' | 'callback' | 'no_answer' | 'failed';
  interest: 'interested' | 'not_interested' | 'unclear';
  recommendation: Outcome;
  checks: ScreeningCheck[];
  /** For no answer: which try this is. For a call-back: how many call-backs already. */
  attempt: number;
}

/** What the school's rules would do with one made-up call, in steps a person can read. */
export function trialRun(rules: ScreeningRules, input: TrialInput): { result: string; tone: 'good' | 'look' | 'bad' | 'wait'; steps: string[] } {
  if (!rules.enabled) return { result: 'Written up only', tone: 'wait', steps: ['The answers and summary appear on the candidate\'s page. HR decides everything by hand.'] };
  if (input.pickup === 'callback') {
    if (mayCallBack(rules, { callback_count: input.attempt })) {
      return { result: 'Call back later', tone: 'wait', steps: ['The candidate asked to be called at another time.', `The AI rings them at the time they asked for, inside calling hours (call-back ${input.attempt + 1} of ${rules.max_callbacks}).`] };
    }
    return { result: 'Flagged for HR', tone: 'look', steps: ['The candidate asked to be called later, but the call-backs allowed are used up.', 'HR is flagged to call them.'] };
  }
  if (input.pickup === 'no_answer') {
    const plan = planAfterNoAnswer(rules, { attempt: input.attempt });
    const steps = [`Try ${input.attempt}: no answer.`];
    if (rules.missed_call_message) steps.push('The candidate gets a "we tried to reach you" message.');
    if (plan.kind === 'retry') return { result: 'Will try again', tone: 'wait', steps: [...steps, `The AI rings again ${rules.retry_gap_hours} ${rules.retry_gap_hours === 1 ? 'hour' : 'hours'} later, inside calling hours.`] };
    return plan.then === 'send_link'
      ? { result: 'Test link sent', tone: 'good', steps: [...steps, 'No more tries left, so the test link is sent anyway.'] }
      : { result: 'Flagged for HR', tone: 'look', steps: [...steps, 'No more tries left. HR is flagged and nothing is sent.'] };
  }
  if (input.pickup === 'failed') {
    return rules.after_failed === 'send_link'
      ? { result: 'Test link sent', tone: 'good', steps: ['The call could not go through.', 'The test link is sent anyway.'] }
      : { result: 'Flagged for HR', tone: 'look', steps: ['The call could not go through.', 'HR is flagged and nothing is sent.'] };
  }
  if (input.interest === 'not_interested' && rules.on_not_interested === 'withdraw') {
    return { result: 'Withdrawn', tone: 'bad', steps: ['The candidate said they are no longer interested.', 'They are marked as withdrawn. Nothing is sent; HR can reopen them.'] };
  }
  const recommendation: Outcome = input.interest === 'not_interested' ? 'not_suitable' : input.recommendation;
  const outcome = outcomeOf(recommendation, input.checks);
  const steps: string[] = [];
  for (const c of input.checks) {
    if (c.result === 'met') continue;
    const must = c.importance !== 'prefer';
    steps.push(`${must ? 'Must-have' : 'Preference'} ${c.result === 'not_met' ? 'not met' : 'not confirmed'}: "${c.requirement}"${must ? (c.result === 'not_met' ? ' → Not suitable.' : ' → at best Needs a look.') : (c.result === 'not_met' ? ' → at best Needs a look.' : ' (changes nothing).')}`);
  }
  steps.push(`Result: ${OUTCOME_LABEL[outcome]}.`);
  const action = actionFor(rules, outcome);
  steps.push(`Then ${DOES[action]}.`);
  const result = action === 'send_link' ? 'Test link sent' : action === 'hold' ? 'Waiting for HR' : action === 'flag' ? 'Flagged for HR' : 'Decline suggested to HR';
  const tone = action === 'send_link' ? 'good' : action === 'suggest_decline' ? 'bad' : 'look';
  if (action === 'hold' || action === 'suggest_decline' || action === 'flag') {
    if (rules.hold_days > 0 && action !== 'flag') {
      steps.push(rules.after_hold === 'send_link' && action === 'hold'
        ? `If HR does nothing for ${rules.hold_days} ${rules.hold_days === 1 ? 'day' : 'days'}, the test link is sent anyway.`
        : `If HR does nothing for ${rules.hold_days} ${rules.hold_days === 1 ? 'day' : 'days'}, HR gets a reminder.`);
    }
  }
  return { result, tone, steps };
}

export { GROUP_KEYS };
