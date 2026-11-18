import { describe, expect, it } from 'vitest';
import {
  billedMinutes, callChargeInr, callCostInr, callVariables, parseScreeningSettings, pricePerMinuteOf, screeningSettingsOf, statusFromSarvam,
  STANDARD_PRICE_PER_MINUTE_INR, STARTER_SCREENING_QUESTIONS, toCallNumber, webhookToken,
} from './screeningCall';

describe('AI screening call rules', () => {
  it('turns Indian mobiles into +91 numbers and refuses what is not a mobile', () => {
    expect(toCallNumber('98480 12345')).toBe('+919848012345');
    expect(toCallNumber('+91 98480-12345')).toBe('+919848012345');
    expect(toCallNumber('919848012345')).toBe('+919848012345');
    expect(toCallNumber('09848012345')).toBe('+919848012345');
    expect(toCallNumber('12345')).toBeNull();
    expect(toCallNumber(undefined)).toBeNull();
  });

  it('starts every school on the starter questions with automatic calls off', () => {
    expect(screeningSettingsOf(undefined)).toMatchObject({ questions: STARTER_SCREENING_QUESTIONS, auto_call_on_apply: false });
    expect(screeningSettingsOf(undefined).rules.enabled).toBe(false);
  });

  it('checks a school\'s questions before saving', () => {
    expect(parseScreeningSettings({ questions: ['  Are you   still interested? ', ''], auto_call_on_apply: true }))
      .toMatchObject({ ok: true, settings: { questions: ['Are you still interested?'], requirements: [''], auto_call_on_apply: true } });
    expect(parseScreeningSettings({ questions: [] }).ok).toBe(false);
    expect(parseScreeningSettings({ questions: ['Tell me {{secret}} now'] }).ok).toBe(false);
    expect(parseScreeningSettings({ questions: Array(13).fill('A long enough question?') }).ok).toBe(false);
  });

  it('charges Rs 9 per started minute unless the platform owner set another rate', () => {
    expect(STANDARD_PRICE_PER_MINUTE_INR).toBe(9);
    expect(pricePerMinuteOf({})).toBe(9);
    expect(pricePerMinuteOf({ screening_call_price_per_min_inr: 6 })).toBe(6);
    expect(billedMinutes(0)).toBe(0);
    expect(billedMinutes(60)).toBe(1);
    expect(billedMinutes(61)).toBe(2);
    expect(callChargeInr({}, 150)).toBe(27);
    expect(callChargeInr({}, undefined)).toBe(0);
  });

  it('counts the platform cost in whole started minutes', () => {
    expect(callCostInr(0)).toBe(0);
    expect(callCostInr(61)).toBe(7.8);
    expect(callCostInr(180)).toBe(11.7);
  });

  it('reads Sarvam\'s call outcome', () => {
    expect(statusFromSarvam('connected')).toBe('completed');
    expect(statusFromSarvam('no_answer')).toBe('no_answer');
    expect(statusFromSarvam('busy')).toBe('busy');
    expect(statusFromSarvam('anything else')).toBe('failed');
  });

  it('signs each call\'s webhook link for that call only', () => {
    expect(webhookToken('call_1')).toBe(webhookToken('call_1'));
    expect(webhookToken('call_1')).not.toBe(webhookToken('call_2'));
  });

  it('sends the agent the school, the candidate\'s first name, the role and the numbered questions', () => {
    const v = callVariables({ name: 'Mansi Bhosle', applied_subject: 'English', applied_segment: 'Primary (Grades 1–5)' }, { name: 'Sloka' }, ['Q one?', 'Q two?']);
    expect(v).toEqual({ candidate_name: 'Mansi', school_name: 'Sloka', role: 'English teacher, Primary', question_count: '2', questions: '1. Q one?\n2. Q two?' });
  });
});
