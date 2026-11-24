import { describe, expect, it } from 'vitest';
import { parseQuestionReply, questionPrompt, standardQuestions, suggestQuestions } from './suggestedQuestions';
import type { Candidate } from './types';

const candidate = {
  id: 'c1', name: 'Ravi', applied_subject: 'Physics', applied_segment: 'Secondary (Grades 9-10)', qualification: 'M.Sc', experience_band: '2-4 years', prior_org: 'Green Valley',
  resume_analysis: { recommended_interview_probes: ['You left a school after one year. Why did you leave that school?'], red_flags: ['A gap of eight months in 2022'], form_vs_cv_discrepancies: [] },
} as unknown as Candidate;
const round = { id: 'subject_lead', name: 'Coordinator' };
const good = JSON.stringify({
  subject: ['How would you explain Newton\'s third law to a nervous student?', 'What do students get wrong about the motion of a falling object?'],
  other: ['Tell me about the eight month gap in 2022 on your CV.', 'How do you calm a noisy class of forty students?'],
});

describe('suggested questions', () => {
  it('falls back to a standard list that includes what the CV review raised', () => {
    const q = standardQuestions(round, candidate);
    expect(q.source).toBe('standard');
    expect(q.subject.length).toBeGreaterThanOrEqual(3);
    expect(q.subject[0]).toContain('Physics');
    expect(q.other[0]).toMatch(/left a school after one year/);
  });

  it('uses a different standard list for each round, and a generic one for a made-up round', () => {
    expect(standardQuestions({ id: 'management' }, candidate).other.join(' ')).toMatch(/salary/i);
    expect(standardQuestions({ id: 'principal' }, candidate).other.join(' ')).toMatch(/parent/i);
    expect(standardQuestions({ id: 'invented' }, candidate).other.length).toBeGreaterThan(2);
  });

  it('reads the AI reply, including when it is wrapped in a code block', () => {
    expect(parseQuestionReply(good)?.subject).toHaveLength(2);
    expect(parseQuestionReply('```json\n' + good + '\n```')?.other).toHaveLength(2);
  });

  it('refuses a reply that is not usable', () => {
    expect(parseQuestionReply('not json')).toBeNull();
    expect(parseQuestionReply('{"subject": ["x"], "other": []}')).toBeNull();
    expect(parseQuestionReply('{"subject": "no", "other": 3}')).toBeNull();
  });

  it('keeps at most six of each, once each, and drops very short or very long ones', () => {
    const many = { subject: Array.from({ length: 10 }, (_, i) => `Question number ${i} about forces?`), other: ['Hi', 'a'.repeat(400), 'Same question here please', 'same question here please', 'Another real question here?'] };
    const r = parseQuestionReply(JSON.stringify(many));
    expect(r?.subject).toHaveLength(6);
    expect(r?.other).toEqual(['Same question here please', 'Another real question here?']);
  });

  it('uses the AI questions when they come back, and says so', async () => {
    const q = await suggestQuestions({ round, candidate, ask: async () => good });
    expect(q.source).toBe('ai');
    expect(q.subject[0]).toMatch(/Newton/);
  });

  it('falls back, never throws, when the AI fails or is not set up', async () => {
    expect((await suggestQuestions({ round, candidate, ask: async () => { throw new Error('down'); } })).source).toBe('standard');
    expect((await suggestQuestions({ round, candidate, ask: async () => 'garbage' })).source).toBe('standard');
    expect((await suggestQuestions({ round, candidate })).source).toBe('standard');
  });

  it('tells the AI about the weak spots and the CV, and not to ask about private matters', () => {
    const p = questionPrompt(round, candidate, { improvements: ['Vague on misconceptions'], strengths: ['Clear explanations'] });
    expect(p).toContain('Vague on misconceptions');
    expect(p).toContain('A gap of eight months in 2022');
    expect(p).toMatch(/religion/);
  });
});
