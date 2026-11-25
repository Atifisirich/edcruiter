/**
 * Gemini as the agent's brain, the alternative to Sarvam's chat model. The
 * help bot already uses the same model with thinking turned right down, and it
 * starts answering in about a second.
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { ChatDelta, ChatMessage, ChatProvider } from './providers';

export class GeminiChat implements ChatProvider {
  readonly model: string;
  private readonly ai: GoogleGenAI;

  constructor(private readonly cfg: { apiKey: string; model?: string; temperature?: number; maxTokens?: number; client?: GoogleGenAI }) {
    this.model = cfg.model ?? 'gemini-3.5-flash-lite';
    this.ai = cfg.client ?? new GoogleGenAI({ apiKey: cfg.apiKey });
  }

  async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<ChatDelta> {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const turns = messages.filter((m) => m.role !== 'system');
    // Gemini wants the first turn to come from the person. On a phone call the agent speaks first, so a
    // stand-in opening is added.
    const contents = [
      ...(turns[0]?.role === 'assistant' ? [{ role: 'user', parts: [{ text: '(The call has just connected.)' }] }] : []),
      ...turns.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    ];
    const stream = await this.ai.models.generateContentStream({
      model: this.model,
      contents,
      config: {
        systemInstruction: system,
        temperature: this.cfg.temperature ?? 0.5,
        maxOutputTokens: this.cfg.maxTokens ?? 400,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: signal,
      },
    });
    let last: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number } } | undefined;
    for await (const chunk of stream) {
      last = chunk;
      const text = chunk.text;
      if (text) yield { text };
    }
    const u = last?.usageMetadata;
    yield { usage: { input: u?.promptTokenCount ?? 0, output: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0), cached: u?.cachedContentTokenCount, estimated: !u } };
  }
}
