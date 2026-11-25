/**
 * Real calls to Sarvam: professional female voices for the interviewer, saved as mp3 samples to listen to.
 *   SARVAM_LIVE=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/voice/voices.live.test.ts
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const key = process.env.SARVAM_API_KEY || '';
const EN = 'Good morning, Priya. I am Asha, the interviewer from Edcruiter. This is a structured interview of about eighteen minutes. Please tell me about your teaching career so far.';
const HI = 'नमस्ते प्रिया। मैं आशा हूँ, एडक्रूटर की ओर से आपका इंटरव्यू लूँगी। कृपया अपने पढ़ाने के अनुभव के बारे में बताइए।';
const TE = 'నమస్కారం ప్రియా. నేను ఆశ, ఎడ్‌క్రూటర్ నుండి మీ ఇంటర్వ్యూ తీసుకుంటాను. దయచేసి మీ బోధనా అనుభవం గురించి చెప్పండి.';

describe.skipIf(process.env.SARVAM_LIVE !== '1' || !key)('Sarvam voices, for real', () => {
  it('makes a sample of each professional voice', async () => {
    const out = path.join(process.cwd(), 'voice-samples', 'professional');
    fs.mkdirSync(out, { recursive: true });
    const tries: [string, string, string][] = [
      ['aparna_en_edtech', 'en-IN', EN], ['payal_en_edtech', 'en-IN', EN], ['shabana_en_edtech', 'en-IN', EN],
      ['ritu_en_edtech', 'en-IN', EN], ['simran_en_narration', 'en-IN', EN],
      ['sanchita_hi_interview', 'hi-IN', HI], ['shreya_hi_news', 'hi-IN', HI], ['ritu_hi_edtech', 'hi-IN', HI],
      ['kavitha_te_narration', 'te-IN', TE], ['kavitha_te_conversation', 'te-IN', TE],
    ];
    let ok = 0;
    for (const [speaker, lang, text] of tries) {
      const res = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language_code: lang, speaker, model: 'bulbul:v4-flash', speech_sample_rate: 24000, output_audio_codec: 'mp3' }),
      });
      const body = await res.json().catch(() => ({})) as { audios?: string[]; error?: { message?: string } };
      if (!res.ok || !body.audios?.length) { console.log(`${speaker}: refused (${res.status}) ${body.error?.message ?? ''}`); continue; }
      fs.writeFileSync(path.join(out, `${speaker}.mp3`), Buffer.from(body.audios.join(''), 'base64'));
      console.log(`${speaker}: ok`);
      ok++;
    }
    expect(ok).toBeGreaterThan(0);
  }, 120_000);
});
