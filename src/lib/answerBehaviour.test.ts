import { describe, expect, it } from 'vitest';
import { behaviourSignals, buildBehaviour, cleanMcqRaw, mcqTiming, type TypingStats } from './answerBehaviour';

const typing = (over: Partial<TypingStats> = {}): TypingStats => ({
  chars_typed: 1500, deletions: 90, pauses_over_4s: 14, active_seconds: 600,
  touch: false, chars_final: 1450, words_final: 240, ...over,
});

describe('how the lesson plan was typed', () => {
  it('says nothing about a plan written with pauses and corrections', () => {
    expect(behaviourSignals({ typing: typing() })).toEqual([]);
  });

  it('notices steady typing with no corrections and no pauses', () => {
    const s = behaviourSignals({ typing: typing({ deletions: 2, pauses_over_4s: 0 }) });
    expect(s.join(' ')).toMatch(/deleted or rewritten/);
    expect(s.join(' ')).toMatch(/almost no pauses/);
  });

  it('notices text that did not come from the keyboard', () => {
    const s = behaviourSignals({ typing: typing({ chars_typed: 500, chars_final: 1600 }) });
    expect(s.join(' ')).toMatch(/Only about 31%/);
  });

  it('notices typing faster than people can compose', () => {
    const s = behaviourSignals({ typing: typing({ words_final: 400, active_seconds: 200 }) });
    expect(s.join(' ')).toMatch(/words a minute/);
  });

  it('does not judge typing on a phone, or a short answer', () => {
    expect(behaviourSignals({ typing: typing({ touch: true, deletions: 0, pauses_over_4s: 0 }) })).toEqual([]);
    expect(behaviourSignals({ typing: typing({ words_final: 80, deletions: 0, pauses_over_4s: 0 }) })).toEqual([]);
  });
});

describe('how the questions were answered', () => {
  const at = (gapsSeconds: number[]) => {
    let t = 0;
    return [0, ...gapsSeconds.map((g) => (t += g * 1000))];
  };

  it('says nothing about a varied, readable pace', () => {
    const gaps = [14, 9, 22, 7, 31, 12, 18, 25, 8, 16, 11, 27, 6, 19, 13, 21, 10, 15, 24, 9];
    const m = mcqTiming({ first_answer_ms: at(gaps), changes: 2 })!;
    expect(behaviourSignals({ mcq: m })).toEqual([]);
  });

  it('notices a fast, even pace', () => {
    const m = mcqTiming({ first_answer_ms: at(Array(24).fill(2.5)), changes: 0 })!;
    const s = behaviourSignals({ mcq: m }).join(' ');
    expect(s).toMatch(/every 2.5 seconds/);
    expect(s).toMatch(/under 3 seconds/);
    expect(s).toMatch(/unusually even/);
  });

  it('needs enough answers to say anything', () => {
    const m = mcqTiming({ first_answer_ms: at([1, 1, 1, 1]), changes: 0 })!;
    expect(behaviourSignals({ mcq: m })).toEqual([]);
  });
});

describe('what the server accepts', () => {
  it('clamps rubbish from the browser and ignores non-objects', () => {
    expect(cleanMcqRaw('x')).toBeNull();
    const m = cleanMcqRaw({ first_answer_ms: ['a', -5, 1e12], changes: 'no' })!;
    expect(m.first_answer_ms).toEqual([0, 0, 86_400_000]);
    expect(m.changes).toBe(0);
  });

  it('builds the record from the submitted lesson text', () => {
    const lesson = 'word '.repeat(200);
    const b = buildBehaviour({ chars_typed: 1000, deletions: 50, pauses_over_4s: 10, active_seconds: 500, touch: false }, undefined, lesson)!;
    expect(b.typing?.words_final).toBe(200);
    expect(b.typing?.chars_final).toBe(lesson.length);
    expect(buildBehaviour(undefined, undefined, lesson)).toBeUndefined();
  });
});
