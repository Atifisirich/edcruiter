import { describe, expect, it } from 'vitest';
import { summariseAiUsage } from './aiUsage';

describe('summariseAiUsage', () => {
  it('prices input and output (including thinking) tokens', () => {
    const r = summariseAiUsage('cv', { promptTokenCount: 1_000_000, candidatesTokenCount: 100_000, thoughtsTokenCount: 100_000 });
    expect(r.estimatedUsd).toBeCloseTo(1.5 + 1.8, 3);
  });

  it('separates video and audio tokens', () => {
    const r = summariseAiUsage('demo', {
      promptTokenCount: 30_000,
      promptTokensDetails: [{ modality: 'VIDEO', tokenCount: 25_000 }, { modality: 'AUDIO', tokenCount: 3_000 }, { modality: 'TEXT', tokenCount: 2_000 }]
    });
    expect(r.videoTokens).toBe(25_000);
    expect(r.audioTokens).toBe(3_000);
  });

  it('copes with a response that has no usage numbers', () => {
    expect(summariseAiUsage('x', undefined).estimatedUsd).toBe(0);
  });
});
