/**
 * What a call costs the platform, worked out from what it actually used.
 *
 * Every number below is a price list entry read on 2026-11-19 and can be
 * changed with an environment variable when a price moves or a quote arrives.
 * Rupees, before 18% GST. Where two sources disagreed the dearer figure is the
 * default, so the meter errs on the side of showing a higher cost.
 */

import type { Usage } from './providers';

export interface RateCard {
  /** Sarvam speech-to-text, per minute of audio sent. */
  sttPerMinute: number;
  /** Sarvam Bulbul v4 Flash, per 1,000 characters. Sarvam's two pages say 1.00 and 2.00. */
  ttsPer1kChars: number;
  llmInputPerM: number;
  llmCachedPerM: number;
  llmOutputPerM: number;
  /** Phone provider's voice rate per minute. Vobiz publishes no India rate yet (quote requested); 0.65 is the highest figure it shows. */
  telephonyPerMinute: number;
  /** Vobiz bills WebSocket streaming separately: $0.0034 per minute per stream. */
  streamingPerMinute: number;
  /** Phone minutes are rounded up to this many seconds. Unknown for Vobiz, so a whole minute is assumed. */
  telephonyStepSec: number;
}

export type Brain = 'sarvam' | 'gemini';

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function rateCard(brain: Brain, env: Record<string, string | undefined> = process.env): RateCard {
  const usdInr = num(env.USD_INR, 95);
  const sarvam = brain === 'sarvam';
  return {
    sttPerMinute: num(env.VOICE_STT_INR_PER_MIN, 0.49),
    ttsPer1kChars: num(env.VOICE_TTS_INR_PER_1K, 2.0),
    // Sarvam 105B (introductory price, promised through the end of 2026): Rs 10 in, 0.25 cached, 25 out per million tokens.
    // Gemini 3.5 Flash-Lite: $0.30 in, $0.03 cached, $2.50 out per million tokens.
    llmInputPerM: num(env.VOICE_LLM_IN_INR_PER_M, sarvam ? 10 : 0.3 * usdInr),
    llmCachedPerM: num(env.VOICE_LLM_CACHED_INR_PER_M, sarvam ? 0.25 : 0.03 * usdInr),
    llmOutputPerM: num(env.VOICE_LLM_OUT_INR_PER_M, sarvam ? 25 : 2.5 * usdInr),
    telephonyPerMinute: num(env.VOBIZ_VOICE_INR_PER_MIN, 0.65),
    streamingPerMinute: num(env.VOBIZ_STREAM_INR_PER_MIN, 0.0034 * usdInr),
    telephonyStepSec: num(env.VOBIZ_BILLING_STEP_SEC, 60) || 60,
  };
}

export interface CostBreakdown {
  stt: number;
  tts: number;
  llm: number;
  phone: number;
  total: number;
  /** Phone minutes as billed (rounded up). */
  billedMinutes: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function costOf(usage: Usage, card: RateCard): CostBreakdown {
  const stt = (usage.sttSeconds / 60) * card.sttPerMinute;
  const tts = (usage.ttsChars / 1000) * card.ttsPer1kChars;
  const freshInput = Math.max(0, usage.llmInputTokens - usage.llmCachedTokens);
  const llm = (freshInput * card.llmInputPerM + usage.llmCachedTokens * card.llmCachedPerM + usage.llmOutputTokens * card.llmOutputPerM) / 1_000_000;
  const billedSeconds = usage.streamSeconds > 0 ? Math.ceil(usage.streamSeconds / card.telephonyStepSec) * card.telephonyStepSec : 0;
  const billedMinutes = billedSeconds / 60;
  const phone = billedMinutes * (card.telephonyPerMinute + card.streamingPerMinute);
  return { stt: r2(stt), tts: r2(tts), llm: r2(llm), phone: r2(phone), total: r2(stt + tts + llm + phone), billedMinutes };
}
