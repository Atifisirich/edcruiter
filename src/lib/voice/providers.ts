/**
 * The three things a voice agent needs from outside, as small interfaces:
 * listening (speech to text), thinking (a chat model) and speaking (text to
 * speech). The call engine only knows these shapes, so Sarvam, Gemini or a
 * test double can be swapped in without touching the conversation logic.
 */

import type { Pcm } from './audio';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface TokenUsage {
  input: number;
  output: number;
  /** Input tokens that were served from the provider's cache, when it says. */
  cached?: number;
  /** True when the provider gave no numbers and these are a guess from text length. */
  estimated?: boolean;
}

export type ChatDelta = { text: string; usage?: undefined } | { text?: undefined; usage: TokenUsage };

export interface SttResult { text: string; language?: string }

export interface SttProvider {
  /** `rate` is the sample rate of `pcm`. `hints` are names and terms worth getting right. */
  transcribe(pcm: Pcm, rate: number, opts: { language: string; hints?: string[] }, signal?: AbortSignal): Promise<SttResult>;
}

export interface TtsProvider {
  /** Returns bare samples at exactly `rate`. */
  synthesize(text: string, opts: { language: string; speaker: string; rate: number }, signal?: AbortSignal): Promise<Pcm>;
}

export interface ChatProvider {
  readonly model: string;
  /** Yields text as it is written, then one usage entry at the end. */
  stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<ChatDelta>;
}

export interface VoiceProviders { stt: SttProvider; tts: TtsProvider; chat: ChatProvider }

/** What one call used, in the units the providers bill in. Measured, so the real cost can be worked out. */
export interface Usage {
  /** Seconds of caller speech sent to speech-to-text. */
  sttSeconds: number;
  /** Characters sent to text-to-speech. */
  ttsChars: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  llmCachedTokens: number;
  /** Seconds of call audio streamed through the phone provider (the whole call). */
  streamSeconds: number;
  /** True if any token count above was estimated rather than reported. */
  llmEstimated: boolean;
}

export const emptyUsage = (): Usage => ({ sttSeconds: 0, ttsChars: 0, llmInputTokens: 0, llmOutputTokens: 0, llmCachedTokens: 0, streamSeconds: 0, llmEstimated: false });

/** Rough token count for when a provider reports none: about 3.5 characters per token for English, fewer for Indian scripts. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
