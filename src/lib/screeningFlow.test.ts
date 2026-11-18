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
    expect(actionFor(rules, 'not_suitable')).toBe('flag');
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
    expect(matchingPreset({ ...DEFAULT_RULES, enabled: true, ...careful.rules, retries: 4 })).toBeNull();
  });

  it('explains every rule in a sentence, mentioning must-haves only when there are some', () => {
    const lines = describeRules({ ...DEFAULT_RULES, enabled: true }, 2);
    expect(lines[0]).toMatch(/Good fit.*every must-have is met.*test link is sent to them right away/);
    expect(lines[1]).toMatch(/Needs a look.*HR sees a "Send the test link" button/);
    expect(lines[2]).toMatch(/Not suitable.*flagged/);
    expect(lines.join(' ')).toMatch(/up to 2 times, 4 hours apart, only between 9 am and 7 pm/);
    expect(describeRules({ ...DEFAULT_RULES, enabled: true }, 0)[0]).not.toMatch(/must-have/);
  });

  it('says nothing is automatic when the rules are off, and handles no retries', () => {
    expect(describeRules(DEFAULT_RULES, 0)).toHaveLength(1);
    expect(describeRules({ ...DEFAULT_RULES, enabled: true, retries: 0, after_no_answer: 'send_link' }, 0).join(' ')).toMatch(/There are no retries/);
  });
});
