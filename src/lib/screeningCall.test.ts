import { describe, expect, it } from 'vitest';
import {
  callCostInr, callPriceOf, callVariables, parseScreeningSettings, screeningSettingsOf, statusFromSarvam,
  STANDARD_CALL_PRICE_INR, STARTER_SCREENING_QUESTIONS, toCallNumber, webhookToken,
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
    expect(screeningSettingsOf(undefined)).toEqual({ questions: STARTER_SCREENING_QUESTIONS, auto_call_on_apply: false });
  });

  it('checks a school\'s questions before saving', () => {
    expect(parseScreeningSettings({ questions: ['  Are you   still interested? ', ''], auto_call_on_apply: true }))
      .toEqual({ ok: true, settings: { questions: ['Are you still interested?'], auto_call_on_apply: true } });
    expect(parseScreeningSettings({ questions: [] }).ok).toBe(false);
    expect(parseScreeningSettings({ questions: ['Tell me {{secret}} now'] }).ok).toBe(false);
    expect(parseScreeningSettings({ questions: Array(13).fill('A long enough question?') }).ok).toBe(false);
  });

  it('charges the standard price unless the platform owner set another', () => {
    expect(callPriceOf({})).toBe(STANDARD_CALL_PRICE_INR);
    expect(callPriceOf({ screening_call_price_inr: 25 })).toBe(25);
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
