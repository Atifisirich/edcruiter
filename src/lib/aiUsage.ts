interface UsageDetail {
  modality?: string;
  tokenCount?: number;
}

interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
  promptTokensDetails?: UsageDetail[];
}

// Gemini 3.5 Flash list price, US dollars per million tokens. Thinking tokens
// are billed as output. Update these if Google changes the price.
const INPUT_USD_PER_MILLION = 1.5;
const OUTPUT_USD_PER_MILLION = 9.0;

export interface AiUsageRecord {
  label: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  videoTokens: number;
  audioTokens: number;
  estimatedUsd: number;
}

/** Turns a Gemini response's usage numbers into one record with an estimated cost. */
export function summariseAiUsage(label: string, usage: UsageMetadata | undefined, model?: string): AiUsageRecord {
  const input = usage?.promptTokenCount ?? 0;
  const output = usage?.candidatesTokenCount ?? 0;
  const thinking = usage?.thoughtsTokenCount ?? 0;
  const byModality = (name: string) =>
    (usage?.promptTokensDetails || []).filter((d) => d.modality === name).reduce((s, d) => s + (d.tokenCount ?? 0), 0);
  const usd = (input * INPUT_USD_PER_MILLION + (output + thinking) * OUTPUT_USD_PER_MILLION) / 1_000_000;
  return {
    label,
    model,
    inputTokens: input,
    outputTokens: output,
    thinkingTokens: thinking,
    videoTokens: byModality('VIDEO'),
    audioTokens: byModality('AUDIO'),
    estimatedUsd: Math.round(usd * 10000) / 10000
  };
}

/** One log line per AI call, so the real cost of a candidate can be added up from the server logs. */
export function logAiUsage(label: string, response: { usageMetadata?: UsageMetadata } | undefined, model?: string): AiUsageRecord {
  const record = summariseAiUsage(label, response?.usageMetadata, model);
  console.log(`[ai-usage] ${JSON.stringify(record)}`);
  return record;
}
