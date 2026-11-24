/**
 * A real call to Gemini, to see the screening it makes from HR's words.
 * Skipped unless GEMINI_LIVE=1:
 *   GEMINI_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/leadSetup.live.test.ts
 */
import { describe, expect, it } from 'vitest';
import { generateSetup } from './leadSetup';

describe.skipIf(process.env.GEMINI_LIVE !== '1' || !process.env.GEMINI_API_KEY)('Gemini, for real', () => {
  const school = { name: 'Sloka International School' };
  const fallback = () => { throw new Error('should not fall back'); };

  it('makes a screening from HR’s words, leaving out what must not be asked', async () => {
    const r = await generateSetup({
      brief: 'maths teacher chahiye class 9 10 ke liye, B.Ed must hai, kam se kam 3 saal CBSE experience, 1 month me join kar sake, salary 40k tak, Manneguda daily aa sake. age 35 se kam ho',
      school, fallback,
    });
    console.log(JSON.stringify(r, null, 2));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.setup.questions.length).toBeGreaterThanOrEqual(4);
    expect(r.setup.importance).toContain('must');
    expect(r.setup.questions.join(' ')).not.toMatch(/\bage\b|how old/i);
    // Change one thing in words.
    const c = await generateSetup({ brief: 'maths teacher', school, fallback, current: r.setup, change: 'also ask if they can take Saturday classes, as a preference' });
    console.log(JSON.stringify(c.ok ? c.setup.questions : c, null, 2));
    expect(c.ok && c.setup.questions.some((q) => /saturday/i.test(q))).toBe(true);
  }, 60_000);
});
