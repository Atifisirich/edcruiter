import { describe, expect, it } from 'vitest';
import {
  billedMinutes, callChargeInr, callCostInr, callVariables, parseScreeningSettings, pricePerMinuteOf, questionSetFor, screeningSettingsOf, statusFromSarvam,
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
    expect(v).toMatchObject({ language: 'English', candidate_name: 'Mansi', school_name: 'Sloka', role: 'English teacher, Primary', question_count: '2', questions: '1. Q one?\n2. Q two?', agent_name: 'Priya', max_minutes: '4' });
    expect(v.greeting).toContain('Hello Mansi, this is Priya');
    expect(v.greeting).toContain('Sloka');
    expect(callVariables({ name: 'A B', applied_subject: 'Hindi', applied_segment: '' }, { name: 'S' }, ['Q?'], 'Telugu').language).toBe('Telugu');
  });

  it('keeps each kind of post\'s own questions, and refuses a must-have with nothing written to look for', () => {
    const base = { questions: ['Are you still interested?'], importance: ['ask'] };
    const out = parseScreeningSettings({
      ...base,
      sets: { pre_primary: { questions: ['Do you have NTT training?', ' '], requirements: ['Has NTT', ''], importance: ['prefer', 'must'] }, bogus: { questions: ['Nope?'] } },
      non_teaching_roles: [' Front office ', ''],
      language: 'Hindi',
      limits: { monthly_cap_inr: 2000.4, daily_max_calls: -3 },
      notify: { emails: ['HR@School.in', 'not-an-email'], good_fit_now: true },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.settings.sets).toEqual({ pre_primary: { questions: ['Do you have NTT training?'], requirements: ['Has NTT'], importance: ['prefer'] } });
    expect(out.settings.non_teaching_roles).toEqual(['Front office']);
    expect(out.settings.language).toBe('Hindi');
    expect(out.settings.limits).toEqual({ monthly_cap_inr: 2000, daily_max_calls: 0 });
    expect(out.settings.notify).toEqual({ emails: ['hr@school.in'], good_fit_now: true, daily_digest: false });
    // A question marked as mattering needs the answer the school wants.
    expect(parseScreeningSettings({ questions: ['Do you have a B.Ed degree?'], requirements: [''], importance: ['must'] })).toMatchObject({ ok: false, error: expect.stringContaining('write what answer') });
    const bad = parseScreeningSettings({ ...base, sets: { secondary: { questions: ['Do you have a B.Ed degree?'], requirements: ['{x}'] } } });
    expect(bad).toMatchObject({ ok: false, error: expect.stringContaining('Secondary') });
  });

  it('reads older settings: a written must-have stays a must-have', () => {
    const s = screeningSettingsOf({ screening_call: { questions: ['Notice period?', 'Salary?'], requirements: ['60 days or less', ''], auto_call_on_apply: true } });
    expect(s.importance).toEqual(['must', 'ask']);
    expect(s.auto_call).toEqual({ delay_min: 0, heads_up: false, min_cv_score: 0, groups: [] });
    expect(s.language).toBe('English');
  });

  it('asks each candidate the questions for their kind of post', () => {
    const s = screeningSettingsOf({ screening_call: { questions: ['Main question?'], auto_call_on_apply: false, non_teaching_roles: ['Accountant'], sets: { senior_secondary: { questions: ['Senior question?'], requirements: [''], importance: ['ask'] }, non_teaching: { questions: ['Office question?'], requirements: [''], importance: ['ask'] } } } });
    expect(questionSetFor(s, { applied_subject: 'Physics', applied_segment: 'Senior Secondary (Grades 11–12, 16–18 yrs)' })).toMatchObject({ group: 'senior_secondary', own: true, questions: ['Senior question?'] });
    expect(questionSetFor(s, { applied_subject: 'accountant', applied_segment: '' })).toMatchObject({ group: 'non_teaching', questions: ['Office question?'] });
    expect(questionSetFor(s, { applied_subject: 'English', applied_segment: '', applied_grades: ['2', '3'] })).toMatchObject({ group: 'primary', own: false, questions: ['Main question?'] });
  });

  it('fills the school\'s own script and variables into what the agent gets', () => {
    const parsed = parseScreeningSettings({
      questions: ['Is {{salary_range}} a month fine for you?'],
      requirements: ['Accepts {{salary_range}}'],
      importance: ['must'],
      script: {
        agent_name: 'Anika', tone: 'formal', max_minutes: 3,
        greeting: 'Namaste {{candidate_name}}, {{agent_name}} from {{school_name}} at {{campus}}.',
        closing: 'Thanks {{candidate_full_name}}.',
        school_info: 'Bus from {{campus}}.',
        variables: [{ key: 'salary_range', value: 'Rs 30,000' }, { key: 'campus', value: 'Tukkuguda' }],
      },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const v = callVariables({ name: 'Mansi Bhosle', applied_subject: 'English', applied_segment: '' }, { name: 'Sloka' }, parsed.settings.questions, 'English', parsed.settings.script);
    expect(v.greeting).toBe('Namaste Mansi, Anika from Sloka at Tukkuguda.');
    expect(v.closing).toBe('Thanks Mansi Bhosle.');
    expect(v.school_info).toBe('Salary range: Rs 30,000\nCampus: Tukkuguda\nBus from Tukkuguda.');
    expect(v.questions).toBe('1. Is Rs 30,000 a month fine for you?');
    expect(v.tone).toMatch(/to the point/);
    expect(v.max_minutes).toBe('3');
  });

  it('refuses unknown or badly named variables, and keeps the standard script when none is set', () => {
    expect(parseScreeningSettings({ questions: ['A fine question?'], script: { greeting: 'Hi {{nope}}' } }).ok).toBe(false);
    // A detail with a name and no value yet is dropped, not refused.
    expect(parseScreeningSettings({ questions: ['A fine question?'], script: { variables: [{ key: 'campus', value: '' }] } })).toMatchObject({ ok: true, settings: { script: { variables: [] } } });
    expect(parseScreeningSettings({ questions: ['A fine question?'], script: { variables: [{ key: 'school_name', value: 'x' }] } }).ok).toBe(false);
    expect(parseScreeningSettings({ questions: ['A fine question?'], script: { variables: [{ key: 'Bad Key', value: 'x' }] } }).ok).toBe(false);
    expect(parseScreeningSettings({ questions: ['A fine {question}?'] }).ok).toBe(false);
    expect(screeningSettingsOf(undefined).script.agent_name).toBe('Priya');
  });
});
