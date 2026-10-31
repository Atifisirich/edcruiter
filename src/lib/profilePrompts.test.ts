import { describe, expect, it } from 'vitest';
import { buildTextPrompt, buildVideoPrompt, parseTextReply, parseVideoReply, textFactorDefs, videoFactorDefs } from './profilePrompts';

const input = {
  candidateName: 'Priya',
  subject: 'Biology',
  segment: 'Secondary 9-10',
  lessonPlan: 'Photosynthesis lesson plan...',
  demoTranscript: 'Today we learn about leaves.',
  scenarioTranscript: 'I would calm the student first.',
  resumeText: 'M.Sc Botany',
};

describe('the text prompt', () => {
  it('asks for every answer-based factor and none that need the video', () => {
    const prompt = buildTextPrompt(input);
    expect(prompt).toContain('"professionalism"');
    expect(prompt).toContain('"safeguarding_awareness"');
    expect(prompt).toContain('"grammar"');
    expect(prompt).not.toContain('"eye_contact"');
    expect(prompt).not.toContain('"articulation"');
    expect(textFactorDefs().some((d) => d.source === 'video')).toBe(false);
  });

  it('forbids judging on identity and tells the model not to guess', () => {
    const prompt = buildTextPrompt(input);
    expect(prompt).toMatch(/religion/);
    expect(prompt).toMatch(/accent/);
    expect(prompt).toMatch(/null/);
    expect(prompt).toMatch(/Never use he or she/);
  });

  it('includes what the candidate submitted, and says so when something is missing', () => {
    expect(buildTextPrompt(input)).toContain('Photosynthesis lesson plan');
    expect(buildTextPrompt({ ...input, scenarioTranscript: '' })).toContain('(nothing submitted)');
  });

  it('cuts a very long answer instead of sending all of it', () => {
    const prompt = buildTextPrompt({ ...input, lessonPlan: 'word '.repeat(5000) });
    expect(prompt).toContain('[...cut for length]');
  });
});

describe('the video prompt', () => {
  it('protects religious and cultural dress, and says a poor camera is not the candidate\'s fault', () => {
    const prompt = buildVideoPrompt({ subject: 'Biology', segment: 'Secondary 9-10', delivery: true, appearance: true });
    expect(prompt).toMatch(/turban/);
    expect(prompt).toMatch(/NEVER a reason to score lower/);
    expect(prompt).toMatch(/poor camera/);
  });

  it('asks about attire and grooming only when the school switched them on', () => {
    expect(buildVideoPrompt({ subject: 'x', segment: 'y', delivery: true, appearance: false })).not.toContain('"attire"');
    expect(buildVideoPrompt({ subject: 'x', segment: 'y', delivery: true, appearance: true })).toContain('"attire"');
  });

  it('asks only for audio-based parts when the school turned delivery notes off', () => {
    const keys = videoFactorDefs({ delivery: false, appearance: false }).map((d) => d.key);
    expect(keys).toEqual(['articulation', 'voice_modulation']);
  });
});

describe('reading the model\'s reply', () => {
  const reply = '```json\n' + JSON.stringify({
    summary: 'A solid candidate.',
    strengths: ['Clear explanations', 'Good questions'],
    improvements: ['Needs more differentiation'],
    relevancy: { lesson: 80, demo: '65', scenario: null },
    factors: { professionalism: { score: 70, reason: 'Respectful.', quote: 'I would calm the student first' } },
  }) + '\n```';

  it('parses a reply wrapped in a code fence', () => {
    const parsed = parseTextReply(reply)!;
    expect(parsed.summary).toBe('A solid candidate.');
    expect(parsed.strengths).toHaveLength(2);
    expect(parsed.factors.professionalism).toMatchObject({ score: 70 });
    expect(parsed.relevancy).toEqual({ lesson: 80, demo: 65, scenario: null });
  });

  it('returns null for a reply that is not usable', () => {
    expect(parseTextReply('Sorry, I cannot help with that.')).toBeNull();
    expect(parseTextReply('{"summary":"x"}')).toBeNull();
    expect(parseTextReply('')).toBeNull();
  });

  it('reads the video reply', () => {
    expect(parseVideoReply('{"factors":{"eye_contact":{"score":70,"reason":"ok"}}}')).toHaveProperty('eye_contact');
    expect(parseVideoReply('nothing')).toBeNull();
  });
});
