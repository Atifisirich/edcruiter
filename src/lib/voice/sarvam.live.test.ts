/**
 * Real calls to Sarvam, to check the interview bot's parts work with our key.
 * Skipped unless SARVAM_LIVE=1, because they cost a few paise and need the network:
 *   SARVAM_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/voice/sarvam.live.test.ts
 */
import { describe, expect, it } from 'vitest';
import { addUsage, ownEngine, PLAY_RATE, runTurn, speak, transcribe } from './interviewEngine';
import { resample, unwrapWav } from './audio';
import { defaultPlan } from '../aiInterview';
import type { AiInterview, Candidate } from '../types';

const live = process.env.SARVAM_LIVE === '1' && !!process.env.SARVAM_API_KEY;

describe.skipIf(!live)('Sarvam, for real', () => {
  const engine = ownEngine()!;

  it('speaks, then hears what it said', async () => {
    let t = Date.now();
    const wav = await speak(engine, 'Hello Priya. Tell me about a lesson you taught recently.', 'English');
    const ttsMs = Date.now() - t;
    const { pcm } = unwrapWav(wav);
    expect(pcm.length).toBeGreaterThan(PLAY_RATE);
    t = Date.now();
    const heard = await transcribe(engine, resample(pcm, PLAY_RATE, 16_000), 16_000, 'English', ['Priya']);
    const sttMs = Date.now() - t;
    console.log(`voice ${ttsMs} ms (${(pcm.length / PLAY_RATE).toFixed(1)} s of audio), listening ${sttMs} ms: "${heard}"`);
    expect(heard.toLowerCase()).toContain('lesson');
  }, 60_000);

  it('speaks Hindi and Telugu', async () => {
    for (const [lang, text] of [['Hindi', 'नमस्ते, क्या आप तैयार हैं?'], ['Telugu', 'నమస్కారం, మీరు సిద్ధంగా ఉన్నారా?']]) {
      const t = Date.now();
      const wav = await speak(engine, text, lang);
      console.log(`${lang} voice ${Date.now() - t} ms, ${wav.length} bytes`);
      expect(wav.length).toBeGreaterThan(10_000);
    }
  }, 60_000);

  it('holds a real interview: opens, hears spoken answers, follows up, and meters the cost', async () => {
    const plan = defaultPlan({ applied_subject: 'Biology', applied_segment: 'Secondary (Grades 9–10)' });
    const candidate = { id: 'c', school_id: 's', name: 'Ravi Kumar', applied_subject: 'Biology', applied_segment: 'Secondary (Grades 9–10)' } as Candidate;
    let interview: AiInterview = { id: 'int_live', status: 'in_progress', mode: 'live', language: 'English', plan, transcript: [], engine: 'own', started_at: new Date().toISOString() };
    let usage: AiInterview['usage'];
    const answers = [
      'Yes, I am ready.',
      'I have taught biology for five years, first at a CBSE school in Hyderabad and now at an ICSE school. I want this post because I enjoy teaching grade nine and ten.',
      'I left the first school because the commute was very long, about two hours each way.',
    ];
    for (let i = 0; i <= answers.length; i++) {
      let audio: Int16Array | undefined;
      if (i > 0) {
        const { pcm } = unwrapWav(await speak(engine, answers[i - 1], 'English'));
        audio = resample(pcm, PLAY_RATE, 16_000);
      }
      const t = Date.now();
      let firstSay = 0;
      const r = await runTurn({ engine, interview, candidate, schoolName: 'Sloka International School', audio }, (e) => { if (e.type === 'say' && !firstSay) firstSay = Date.now() - t; });
      console.log(`turn ${i}: heard "${r.heard}"\n  Asha (first audio after ${firstSay} ms): ${r.said.join(' ')}`);
      expect(r.said.length).toBeGreaterThan(0);
      if (r.heard) interview = { ...interview, transcript: [...interview.transcript, { role: 'user', text: r.heard }] };
      interview = { ...interview, transcript: [...interview.transcript, { role: 'agent', text: r.said.join(' ') }] };
      usage = addUsage(usage, r.usage, engine.brain);
    }
    console.log('usage after 4 turns:', usage);
    expect(interview.transcript[0].text.toLowerCase()).toContain('ravi');
  }, 180_000);

  it('thinks quickly', async () => {
    const t = Date.now();
    let first = 0;
    let text = '';
    let usage;
    for await (const d of engine.chat.stream([
      { role: 'system', content: 'You are Asha, a formal job interviewer. Reply in at most two short spoken sentences.' },
      { role: 'user', content: 'I have taught maths for six years in CBSE schools.' },
    ])) {
      if (d.text) { if (!first) first = Date.now() - t; text += d.text; }
      if (d.usage) usage = d.usage;
    }
    console.log(`brain ${engine.brain} (${engine.chat.model}): first words ${first} ms, all ${Date.now() - t} ms: "${text}"`, usage);
    expect(text.length).toBeGreaterThan(5);
  }, 60_000);
});
