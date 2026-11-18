import { describe, expect, it } from 'vitest';
import { actionFor, cleanRequirements, DEFAULT_RULES, nextInWindow, normalizeRules, outcomeOf, planAfterNoAnswer } from './screeningFlow';
import { parseScreeningSettings, screeningSettingsOf } from './screeningCall';

const rules = { ...DEFAULT_RULES, enabled: true };
const check = (result: 'met' | 'not_met' | 'unclear') => ({ question: 'Q', requirement: 'R', result });

describe('what a call result leads to', () => {
  it('is off until the school switches it on, with sensible starting choices', () => {
    expect(DEFAULT_RULES.enabled).toBe(false);
    expect(actionFor(rules, 'proceed')).toBe('send_link');
    expect(actionFor(rules, 'maybe')).toBe('hold');
    // A decline is only ever suggested: HR presses the button.
    expect(actionFor(rules, 'not_suitable')).toBe('suggest_decline');
  });

  it('treats a preference not met as "needs a look", never as not suitable', () => {
    const pref = (result: 'met' | 'not_met' | 'unclear') => ({ ...check(result), importance: 'prefer' as const });
    expect(outcomeOf('proceed', [pref('not_met')])).toBe('maybe');
    expect(outcomeOf('proceed', [pref('unclear')])).toBe('proceed');
    expect(outcomeOf('proceed', [pref('not_met'), check('not_met')])).toBe('not_suitable');
  });

  it('follows the school\'s own choices', () => {
    const own = normalizeRules({ enabled: true, on_proceed: 'hold', on_maybe: 'send_link', on_not_suitable: 'hold' });
    expect(actionFor(own, 'proceed')).toBe('hold');
    expect(actionFor(own, 'maybe')).toBe('send_link');
    expect(actionFor(own, 'not_suitable')).toBe('hold');
  });

  it('never makes a result better than the AI said, and a missed must-have makes it not suitable', () => {
    expect(outcomeOf('proceed', [check('met')])).toBe('proceed');
    expect(outcomeOf('proceed', [check('met'), check('not_met')])).toBe('not_suitable');
    expect(outcomeOf('proceed', [check('unclear')])).toBe('maybe');
    expect(outcomeOf('not_suitable', [check('met')])).toBe('not_suitable');
    expect(outcomeOf('maybe', [])).toBe('maybe');
    expect(outcomeOf(undefined, undefined)).toBe('maybe');
  });
});

describe('when nobody picks up', () => {
  const noon = new Date('2026-11-18T06:30:00Z'); // 12:00 India time

  it('tries again after the gap, then gives up as the school chose', () => {
    const plan = planAfterNoAnswer({ ...rules, retries: 2, retry_gap_hours: 4 }, { attempt: 1 }, noon);
    expect(plan).toEqual({ kind: 'retry', at: new Date('2026-11-18T10:30:00Z') });
    expect(planAfterNoAnswer({ ...rules, retries: 2 }, { attempt: 2 }, noon).kind).toBe('retry');
    expect(planAfterNoAnswer({ ...rules, retries: 2, after_no_answer: 'send_link' }, { attempt: 3 }, noon)).toEqual({ kind: 'give_up', then: 'send_link' });
    expect(planAfterNoAnswer({ ...rules, retries: 0 }, { attempt: 1 }, noon)).toEqual({ kind: 'give_up', then: 'flag' });
  });

  it('only rings inside the calling hours, India time', () => {
    const window = { window_start_hour: 9, window_end_hour: 19 };
    // 8 pm India time: wait until 9 am the next morning
    expect(nextInWindow(new Date('2026-11-18T14:30:00Z'), window)).toEqual(new Date('2026-11-19T03:30:00Z'));
    // 6 am India time: wait until 9 am the same day
    expect(nextInWindow(new Date('2026-11-18T00:30:00Z'), window)).toEqual(new Date('2026-11-18T03:30:00Z'));
    // 2 pm India time: now
    const two = new Date('2026-11-18T08:30:00Z');
    expect(nextInWindow(two, window)).toBe(two);
  });
});

describe('the rules a school saves', () => {
  it('put wrong numbers right', () => {
    const r = normalizeRules({ enabled: true, retries: 99, retry_gap_hours: 0, window_start_hour: 20, window_end_hour: 10, on_proceed: 'bogus' });
    expect(r.retries).toBe(DEFAULT_RULES.retries);
    expect(r.retry_gap_hours).toBe(DEFAULT_RULES.retry_gap_hours);
    expect(r.window_end_hour).toBeGreaterThan(r.window_start_hour);
    expect(r.on_proceed).toBe('send_link');
  });

  it('keep each must-have with its question, and drop both when a question is left blank', () => {
    const out = parseScreeningSettings({
      questions: ['Is your notice period short?', '', 'Do you have a B.Ed degree?'],
      requirements: ['60 days or less', 'ignored', ' Must say yes '],
      rules: { enabled: true },
    });
    expect(out).toMatchObject({ ok: true, settings: { questions: ['Is your notice period short?', 'Do you have a B.Ed degree?'], requirements: ['60 days or less', 'Must say yes'] } });
    expect(cleanRequirements(['a', 'b'], ['x'])).toEqual(['x', '']);
    expect(parseScreeningSettings({ questions: ['Is your notice period short?'], requirements: ['{{x}}'] }).ok).toBe(false);
  });

  it('start with no rules switched on and no must-haves', () => {
    const s = screeningSettingsOf(undefined);
    expect(s.rules.enabled).toBe(false);
    expect(s.requirements.every((r) => r === '')).toBe(true);
  });
});

import { describeRules, matchingPreset, RULE_PRESETS } from './screeningFlow';

describe('presets and the plain-words summary', () => {
  it('recognises a preset, and says none when the rules were changed', () => {
    const careful = RULE_PRESETS[0];
    expect(matchingPreset({ ...DEFAULT_RULES, enabled: true, ...careful.rules })).toBe('careful');
    expect(matchingPreset({ ...DEFAULT_RULES, enabled: true, ...careful.rules, on_maybe: 'flag' })).toBeNull();
  });

  it('explains every rule in a sentence, mentioning must-haves only when there are some', () => {
    const lines = describeRules({ ...DEFAULT_RULES, enabled: true }, 2);
    expect(lines[0]).toMatch(/Good fit.*every must-have is met.*test link is sent to them right away/);
    expect(lines[1]).toMatch(/Needs a look.*HR sees a "Send the test link" button/);
    expect(lines[2]).toMatch(/Not suitable.*"Send the decline" button.*only when HR presses it/);
    expect(lines.join(' ')).toMatch(/up to 2 times, 4 hours apart, between 9 am and 7 pm \(India time, not on Sundays\)/);
    expect(lines.join(' ')).toMatch(/A decline is never sent without HR/);
    expect(describeRules({ ...DEFAULT_RULES, enabled: true }, 0)[0]).not.toMatch(/must-have/);
  });

  it('says nothing is automatic when the rules are off, and handles no retries', () => {
    expect(describeRules(DEFAULT_RULES, 0)).toHaveLength(1);
    expect(describeRules({ ...DEFAULT_RULES, enabled: true, retries: 0, after_no_answer: 'send_link' }, 0).join(' ')).toMatch(/There are no retries/);
  });
});

import { callbackTime, callLanguage, groupOf, monthlyCapOf, trialRun } from './screeningFlow';

describe('the new call rules', () => {
  const on = { ...DEFAULT_RULES, enabled: true };

  it('skips Sundays when the school asks', () => {
    // Saturday 21 Nov 2026, 8 pm India time: Sunday is skipped, so Monday 9 am.
    const satNight = new Date('2026-11-21T14:30:00Z');
    expect(nextInWindow(satNight, { ...on, skip_sundays: true })).toEqual(new Date('2026-11-23T03:30:00Z'));
    expect(nextInWindow(satNight, { ...on, skip_sundays: false })).toEqual(new Date('2026-11-22T03:30:00Z'));
  });

  it('rings back at the time asked for, inside calling hours, or two hours later when the time makes no sense', () => {
    const noon = new Date('2026-11-18T06:30:00Z'); // Wed 12:00 India time
    expect(callbackTime('2026-11-18T16:00:00+05:30', on, noon)).toEqual(new Date('2026-11-18T10:30:00Z'));
    // "Call me at 10 pm": moved to 9 am the next day.
    expect(callbackTime('2026-11-18T22:00:00+05:30', on, noon)).toEqual(new Date('2026-11-19T03:30:00Z'));
    expect(callbackTime('garbage', on, noon)).toEqual(new Date('2026-11-18T08:30:00Z'));
    expect(callbackTime('2020-01-01T10:00:00+05:30', on, noon)).toEqual(new Date('2026-11-18T08:30:00Z'));
  });

  it('tells the kind of post from the grades, the level, or the school\'s non-teaching list', () => {
    expect(groupOf({ applied_subject: 'English', applied_segment: '', applied_grades: ['lkg'] })).toBe('pre_primary');
    expect(groupOf({ applied_subject: 'Math', applied_segment: 'Middle School (Grades 6–8, 11–14 yrs)' })).toBe('middle');
    expect(groupOf({ applied_subject: 'Math', applied_segment: 'Secondary (Grades 9–10)' })).toBe('secondary');
    expect(groupOf({ applied_subject: 'Physics', applied_segment: 'Senior Secondary (Grades 11–12)' })).toBe('senior_secondary');
    expect(groupOf({ applied_subject: 'Front Office', applied_segment: 'Primary' }, ['front office'])).toBe('non_teaching');
    expect(groupOf({ applied_subject: 'Math', applied_segment: '' })).toBeNull();
  });

  it('picks the call language', () => {
    expect(callLanguage('Hindi', ['English'])).toBe('Hindi');
    expect(callLanguage('auto', ['Telugu', 'Hindi'])).toBe('Hindi');
    expect(callLanguage('auto', ['Telugu'])).toBe('Telugu');
    expect(callLanguage('auto', [])).toBe('English');
  });

  it('uses the lower of the school\'s and the owner\'s monthly limits', () => {
    expect(monthlyCapOf(0, 0)).toBe(0);
    expect(monthlyCapOf(5000, 0)).toBe(5000);
    expect(monthlyCapOf(5000, 3000)).toBe(3000);
    expect(monthlyCapOf(undefined, 2000)).toBe(2000);
  });

  it('shows in "Try it" what would happen, without ever sending a decline on its own', () => {
    const must = { question: 'Q', requirement: 'Has a B.Ed', importance: 'must' as const, result: 'not_met' as const };
    const out = trialRun(on, { pickup: 'answered', interest: 'interested', recommendation: 'proceed', checks: [must], attempt: 1 });
    expect(out.result).toBe('Decline suggested to HR');
    expect(out.steps.join(' ')).toMatch(/only when HR presses it/);
    expect(trialRun(on, { pickup: 'answered', interest: 'not_interested', recommendation: 'proceed', checks: [], attempt: 1 }).result).toBe('Withdrawn');
    expect(trialRun(on, { pickup: 'callback', interest: 'unclear', recommendation: 'maybe', checks: [], attempt: 0 }).result).toBe('Call back later');
    expect(trialRun(on, { pickup: 'callback', interest: 'unclear', recommendation: 'maybe', checks: [], attempt: 2 }).result).toBe('Flagged for HR');
    expect(trialRun(on, { pickup: 'no_answer', interest: 'unclear', recommendation: 'maybe', checks: [], attempt: 3 }).result).toBe('Flagged for HR');
    expect(trialRun(DEFAULT_RULES, { pickup: 'answered', interest: 'interested', recommendation: 'proceed', checks: [], attempt: 1 }).result).toBe('Written up only');
  });

  it('reads older saved rules safely', () => {
    const old = normalizeRules({ enabled: true, on_proceed: 'send_link', on_maybe: 'hold', on_not_suitable: 'flag', retries: 2, retry_gap_hours: 4, after_no_answer: 'flag', window_start_hour: 9, window_end_hour: 19 });
    expect(old.on_not_suitable).toBe('flag');
    expect(old.max_callbacks).toBe(2);
    expect(old.after_failed).toBe('flag');
  });
});
