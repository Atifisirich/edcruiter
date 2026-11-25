/**
 * Sarvam as the agent's ears (speech-to-text), brain (chat) and voice
 * (text-to-speech). Plain `fetch`, no SDK. Docs read on 2026-11-19:
 *   docs.sarvam.ai/api-reference/speech-to-text/transcribe
 *   docs.sarvam.ai/api-reference/text-to-speech/convert
 *   docs.sarvam.ai/api/token-factory/chat-completions
 *   docs.sarvam.ai/api/integration/build-voice-agent-with-vobiz
 */

import { resample, unwrapWav, wavWrap, concatPcm, type Pcm } from './audio';
import {
  estimateTokens, type ChatDelta, type ChatMessage, type ChatProvider, type SttProvider, type SttResult, type TtsProvider,
} from './providers';

const BASE = 'https://api.sarvam.ai';

export class SarvamError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'SarvamError'; }
}

export interface SarvamConfig {
  apiKey: string;
  /** Test hook: replaces `fetch`. */
  fetchImpl?: typeof fetch;
  /** Give up on one request after this long. A live call cannot wait. */
  timeoutMs?: number;
}

function joinSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
  return AbortSignal.any(signals.filter((s): s is AbortSignal => !!s));
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  try {
    const j = JSON.parse(text) as { error?: { message?: string; code?: string }; detail?: unknown };
    if (j.error?.message) return `${j.error.code ? j.error.code + ': ' : ''}${j.error.message}`.slice(0, 300);
    if (j.detail) return JSON.stringify(j.detail).slice(0, 300);
  } catch { /* not JSON */ }
  return text.slice(0, 300);
}

/** One request, with one quick retry for network trouble and server errors (not for bad requests or empty wallets). */
async function call(cfg: SarvamConfig, path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const doFetch = cfg.fetchImpl ?? fetch;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await doFetch(`${BASE}${path}`, {
        ...init,
        headers: { 'api-subscription-key': cfg.apiKey, ...(init.headers as Record<string, string> | undefined) },
        signal: joinSignals(signal, AbortSignal.timeout(cfg.timeoutMs ?? 15_000)),
      });
      if (res.ok) return res;
      const why = await readError(res);
      lastError = new SarvamError(`Sarvam ${path} failed (${res.status}): ${why}`, res.status);
      if (res.status < 500 && res.status !== 429) throw lastError;
    } catch (err) {
      if (err instanceof SarvamError && err.status && err.status < 500 && err.status !== 429) throw err;
      if (signal?.aborted) throw err;
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw lastError instanceof Error ? lastError : new SarvamError(`Sarvam ${path} failed`);
}

// --- Ears --------------------------------------------------------------------

export class SarvamStt implements SttProvider {
  constructor(private readonly cfg: SarvamConfig & { model?: string; mode?: string }) {}

  async transcribe(pcm: Pcm, rate: number, opts: { language: string; hints?: string[] }, signal?: AbortSignal): Promise<SttResult> {
    const model = this.cfg.model ?? 'saaras:v4';
    // Sarvam works best at 16 kHz; phone audio at 8 kHz is brought up to it.
    const wav = wavWrap(resample(pcm, rate, 16_000), 16_000);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'caller.wav');
    form.append('model', model);
    // codemix keeps English words in English and Indian words in their own script, which suits Hinglish.
    form.append('mode', this.cfg.mode ?? 'codemix');
    form.append('language_code', opts.language);
    // Only saaras:v4 takes key terms. Names and subjects the call is about are heard far more reliably with them.
    if (model.startsWith('saaras:v4') && opts.hints?.length) {
      form.append('keyterms', JSON.stringify(opts.hints.map((h) => h.trim().slice(0, 64)).filter(Boolean).slice(0, 50)));
    }
    const res = await call(this.cfg, '/speech-to-text', { method: 'POST', body: form }, signal);
    const body = (await res.json()) as { transcript?: string; language_code?: string | null };
    return { text: (body.transcript ?? '').trim(), language: body.language_code || undefined };
  }
}

// --- Brain -------------------------------------------------------------------

export class SarvamChat implements ChatProvider {
  readonly model: string;
  constructor(private readonly cfg: SarvamConfig & { model?: string; temperature?: number; maxTokens?: number }) {
    this.model = cfg.model ?? 'sarvam-105b';
  }

  async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<ChatDelta> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true,
      temperature: this.cfg.temperature ?? 0.5,
      // A phone reply is a sentence or two. The cap only stops a runaway answer.
      max_tokens: this.cfg.maxTokens ?? 400,
    };
    // sarvam-105b thinks before answering unless told not to. Thinking is billed as output and adds seconds of
    // silence on the line, so it is switched off. ("sarvam-105b-conversations" never thinks and ignores this.)
    body.reasoning_effort = null;
    const res = await call(this.cfg, '/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, signal);
    if (!res.body) throw new SarvamError('Sarvam chat returned no stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let written = '';
    let reported: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | undefined;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          let chunk: { choices?: { delta?: { content?: string | null } }[]; usage?: typeof reported };
          try { chunk = JSON.parse(data); } catch { continue; }
          if (chunk.usage) reported = chunk.usage;
          for (const choice of chunk.choices ?? []) {
            // `reasoning_content` is the model's private thinking and must never be spoken, so only `content` is read.
            const text = choice.delta?.content;
            if (text) { written += text; yield { text }; }
          }
        }
      }
    } finally {
      reader.cancel().catch(() => undefined);
    }
    if (reported && typeof reported.prompt_tokens === 'number') {
      yield { usage: { input: reported.prompt_tokens, output: reported.completion_tokens ?? 0, cached: reported.prompt_tokens_details?.cached_tokens } };
    } else {
      yield { usage: { input: estimateTokens(messages.map((m) => m.content).join('\n')), output: estimateTokens(written), estimated: true } };
    }
  }
}

// --- Voice -------------------------------------------------------------------

/** Sample rates Bulbul can produce directly. Anything else is made at 24 kHz and converted. */
const TTS_RATES = [8000, 16000, 22050, 24000];

export class SarvamTts implements TtsProvider {
  constructor(private readonly cfg: SarvamConfig & { model?: string; pace?: number; temperature?: number }) {}

  async synthesize(text: string, opts: { language: string; speaker: string; rate: number }, signal?: AbortSignal): Promise<Pcm> {
    const asked = TTS_RATES.includes(opts.rate) ? opts.rate : 24_000;
    const res = await call(this.cfg, '/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 2400),
        target_language_code: opts.language,
        // No speaker: Sarvam uses the model's default voice.
        ...(opts.speaker ? { speaker: opts.speaker } : {}),
        model: this.cfg.model ?? 'bulbul:v4-flash',
        speech_sample_rate: asked,
        output_audio_codec: 'linear16',
        ...(this.cfg.pace ? { pace: this.cfg.pace } : {}),
        ...(this.cfg.temperature ? { temperature: this.cfg.temperature } : {}),
      }),
    }, signal);
    const body = (await res.json()) as { audios?: string[] };
    return this.toPcm(body, asked, opts.rate);
  }

  /** The sentence as a ready-to-play file (mp3 by default): far smaller than raw samples, for sending to a browser. */
  async synthesizeEncoded(text: string, opts: { language: string; speaker: string; rate: number }, codec: 'mp3' | 'wav' = 'mp3', signal?: AbortSignal): Promise<Uint8Array> {
    const rate = TTS_RATES.includes(opts.rate) ? opts.rate : 24_000;
    const res = await call(this.cfg, '/text-to-speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 2400),
        target_language_code: opts.language,
        ...(opts.speaker ? { speaker: opts.speaker } : {}),
        model: this.cfg.model ?? 'bulbul:v4-flash',
        speech_sample_rate: rate,
        output_audio_codec: codec,
        ...(this.cfg.pace ? { pace: this.cfg.pace } : {}),
        ...(this.cfg.temperature ? { temperature: this.cfg.temperature } : {}),
      }),
    }, signal);
    const body = (await res.json()) as { audios?: string[] };
    const bytes = Buffer.concat((body.audios ?? []).map((b64) => Buffer.from(b64, 'base64')));
    if (bytes.length === 0) throw new SarvamError('Sarvam text-to-speech returned no audio');
    return new Uint8Array(bytes);
  }

  private toPcm(body: { audios?: string[] }, asked: number, rate: number): Pcm {
    const opts = { rate };
    const parts = (body.audios ?? []).map((b64) => {
      const { pcm, rate } = unwrapWav(Buffer.from(b64, 'base64'));
      return rate && rate !== opts.rate ? resample(pcm, rate, opts.rate) : resample(pcm, asked, opts.rate);
    });
    const audio = concatPcm(parts);
    if (audio.length === 0) throw new SarvamError('Sarvam text-to-speech returned no audio');
    return audio;
  }
}
