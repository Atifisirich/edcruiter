import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for Google: each model behaves the way the test says.
const behaviour: Record<string, 'hang' | 'fail' | 'answer'> = {};
const asked: string[] = [];
vi.mock('@google/genai', () => ({
  ThinkingLevel: { MINIMAL: 'MINIMAL' },
  GoogleGenAI: class {
    models = {
      generateContentStream: async ({ model, config }: { model: string; config: { abortSignal: AbortSignal } }) => {
        asked.push(model);
        const how = behaviour[model];
        if (how === 'fail') throw new Error('503 overloaded');
        if (how === 'hang') {
          await new Promise((_, reject) => config.abortSignal.addEventListener('abort', () => reject(new Error('aborted'))));
        }
        return (async function* () {
          yield { text: `Answer from ${model}.` };
          yield { text: '\n<<META>>{"offer_team": false, "summary": "s", "link": ""}' };
        })();
      },
    };
  },
}));

import { BACKUP_MODEL, MODEL, streamAssistant } from './assistant';

const run = async () => {
  let words = '';
  let done: unknown;
  for await (const e of streamAssistant([{ role: 'user', text: 'How do I add a candidate?' }], { kind: 'staff', role: 'admin', page: '/admin' })) {
    if (e.t === 'delta') words += e.text;
    if (e.t === 'done') done = e;
  }
  return { words, done };
};

describe('the help bot never waits on one slow model', () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = 'test-key'; asked.length = 0; vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('uses the main model when it answers', async () => {
    behaviour[MODEL] = 'answer';
    const out = await run();
    expect(out.words).toBe(`Answer from ${MODEL}.\n`);
    expect(asked).toEqual([MODEL]);
  });

  it('goes to the backup straight away when the main model fails', async () => {
    behaviour[MODEL] = 'fail';
    behaviour[BACKUP_MODEL] = 'answer';
    const t0 = Date.now();
    const out = await run();
    expect(out.words).toBe(`Answer from ${BACKUP_MODEL}.\n`);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('asks the backup too when the main model is slow to start, and uses whichever answers', async () => {
    behaviour[MODEL] = 'hang';
    behaviour[BACKUP_MODEL] = 'answer';
    const out = await run();
    expect(out.words).toBe(`Answer from ${BACKUP_MODEL}.\n`);
    expect(asked).toEqual([MODEL, BACKUP_MODEL]);
  }, 10_000);

  it('says sorry and offers the team when both fail', async () => {
    behaviour[MODEL] = 'fail';
    behaviour[BACKUP_MODEL] = 'fail';
    const out = await run();
    expect(out.words).toContain("couldn't get an answer");
    expect(out.done).toMatchObject({ offer_team: true });
  });
});
