import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyseInterview, cleanTurns, defaultPlan, emptyReport, interviewRuntime, interviewVariables, planText, recommendationFor, sampleTranscript,
} from './aiInterview';

const person = { name: 'Asha Rao', applied_subject: 'Chemistry', applied_segment: 'Secondary (Grades 9 and 10)' };

afterEach(() => { vi.unstubAllEnvs(); });

describe('the interview plan', () => {
  it('covers six topics, each with a question and what a strong answer shows', () => {
    const plan = defaultPlan(person);
    expect(plan).toHaveLength(6);
    for (const t of plan) {
      expect(t.key && t.name && t.question && t.looks_for).toBeTruthy();
    }
    expect(plan[0].question).toContain('Chemistry');
    expect(plan[0].question).toContain('Secondary');
    expect(plan[0].question).not.toContain('(Grades');
  });
  it('is written out as numbered text for the agent', () => {
    const text = planText(defaultPlan(person));
    expect(text.split('\n')).toHaveLength(6);
    expect(text).toMatch(/^1\. Motivation and fit\. Ask: /);
  });
});

describe('what the agent is given', () => {
  const vars = interviewVariables(person, 'Green Valley', defaultPlan(person), 'Hindi');
  it('has every variable the Sarvam agent reads, all as text', () => {
    for (const key of ['agent_name', 'candidate_name', 'school_name', 'role', 'language', 'tone', 'greeting', 'interview_plan', 'max_minutes']) {
      expect(typeof vars[key]).toBe('string');
      expect(vars[key]).not.toBe('');
    }
    expect(vars.language).toBe('Hindi');
    expect(vars.greeting).toContain('Hello Asha');
    expect(vars.greeting).toContain('Green Valley');
  });
});

describe('the voice service settings', () => {
  it('is off until the interview agent id is set', () => {
    expect(interviewRuntime({ SARVAM_API_KEY: 'k', SARVAM_ORG_ID: 'o', SARVAM_WORKSPACE_ID: 'w' })).toBeNull();
    expect(interviewRuntime({ SARVAM_API_KEY: 'k', SARVAM_ORG_ID: 'o', SARVAM_WORKSPACE_ID: 'w', SARVAM_INTERVIEW_APP_ID: 'a' })).toMatchObject({ appId: 'a' });
  });
  it('pins a version only when one is given', () => {
    const base = { SARVAM_API_KEY: 'k', SARVAM_ORG_ID: 'o', SARVAM_WORKSPACE_ID: 'w', SARVAM_INTERVIEW_APP_ID: 'a' };
    expect(interviewRuntime(base)?.version).toBeUndefined();
    expect(interviewRuntime({ ...base, SARVAM_INTERVIEW_APP_VERSION: '3' })?.version).toBe(3);
  });
});

describe('reading a transcript', () => {
  it('accepts both role names and both text fields, and drops empty turns', () => {
    const turns = cleanTurns([
      { role: 'assistant', content: ' Hello ' },
      { role: 'user', text: 'Hi there' },
      { role: 'user', content: '   ' },
      null,
    ]);
    expect(turns).toEqual([{ role: 'agent', text: 'Hello' }, { role: 'user', text: 'Hi there' }]);
  });
  it('copes with something that is not a list', () => {
    expect(cleanTurns('nope')).toEqual([]);
    expect(cleanTurns(undefined)).toEqual([]);
  });
});

describe('the report', () => {
  it('maps the overall score to a recommendation', () => {
    expect(recommendationFor(80)).toBe('strong');
    expect(recommendationFor(60)).toBe('good');
    expect(recommendationFor(45)).toBe('mixed');
    expect(recommendationFor(10)).toBe('weak');
  });
  it('never invents scores when there is nothing to score', async () => {
    const plan = defaultPlan(person);
    const none = await analyseInterview(plan, [], person);
    expect(none.scored).toBe(false);
    expect(none.topics.every((t) => t.score === 0)).toBe(true);
    const tiny = await analyseInterview(plan, [{ role: 'agent', text: 'Hello?' }, { role: 'user', text: 'Hi' }], person);
    expect(tiny.scored).toBe(false);
    expect(tiny.summary).toMatch(/too little/);
  });
  it('says so, rather than scoring, when the AI is not available', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const r = await analyseInterview(defaultPlan(person), sampleTranscript(person, 'Green Valley'), person);
    expect(r.scored).toBe(false);
    expect(r.summary).toMatch(/could not be scored/);
  });
  it('has one empty entry per topic', () => {
    const plan = defaultPlan(person);
    expect(emptyReport(plan, 'x').topics.map((t) => t.key)).toEqual(plan.map((t) => t.key));
  });
});

describe('the sample conversation', () => {
  it('is long enough to score, and talks about the candidate\'s own subject', () => {
    const t = sampleTranscript(person, 'Green Valley');
    expect(t.length).toBeGreaterThanOrEqual(12);
    expect(t[0].text).toContain('Green Valley');
    const words = t.filter((x) => x.role === 'user').reduce((n, x) => n + x.text.split(/\s+/).length, 0);
    expect(words).toBeGreaterThan(100);
  });
});
