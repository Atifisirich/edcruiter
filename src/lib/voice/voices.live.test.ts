/**
 * Real calls to Sarvam: which female voices work with our key, how fast, and how big the audio is.
 *   SARVAM_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/voice/voices.live.test.ts
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const key = process.env.SARVAM_API_KEY || '';

describe.skipIf(process.env.SARVAM_LIVE !== '1' || !key)('Sarvam voices, for real', () => {
  it('speaks with each female voice, as mp3', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'voices-'));
    const tries: [string, string, string][] = [
      ['aparna_en_companion', 'en-IN', 'Hello Priya. I am Asha, your interviewer today. Are you ready to begin?'],
      ['sanchita_en_companion', 'en-IN', 'Hello Priya. I am Asha, your interviewer today. Are you ready to begin?'],
      ['simran_en_customer', 'en-IN', 'Hello Priya. I am Asha, your interviewer today. Are you ready to begin?'],
      ['aparna_hi_customer', 'hi-IN', 'नमस्ते प्रिया। मैं आशा हूँ। क्या आप शुरू करने के लिए तैयार हैं?'],
      ['kavitha_te_conversation', 'te-IN', 'నమస్కారం ప్రియా. నేను ఆశ. మీరు సిద్ధంగా ఉన్నారా?'],
    ];
    let ok = 0;
    for (const [speaker, lang, text] of tries) {
      const t = Date.now();
      const res = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language_code: lang, speaker, model: 'bulbul:v4-flash', speech_sample_rate: 24000, output_audio_codec: 'mp3' }),
      });
      const ms = Date.now() - t;
      const body = await res.json().catch(() => ({})) as { audios?: string[]; error?: { message?: string } };
      if (!res.ok || !body.audios?.length) { console.log(`${speaker}: refused (${res.status}) ${body.error?.message ?? ''}`); continue; }
      const bytes = Buffer.from(body.audios.join(''), 'base64');
      fs.writeFileSync(path.join(out, `${speaker}.mp3`), bytes);
      console.log(`${speaker}: ${ms} ms, ${Math.round(bytes.length / 1024)} KB mp3`);
      ok++;
    }
    console.log(`saved in ${out}`);
    expect(ok).toBeGreaterThan(0);
  }, 90_000);
});
