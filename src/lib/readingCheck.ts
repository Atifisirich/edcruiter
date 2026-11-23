/**
 * "Was this answer read out?" for one stage, for the reviewer.
 *
 * Candidates read answers from a phone held near the camera. No single signal
 * proves it, so several are weighed together:
 * - what the camera saw: how much of the speaking time the eyes were down, and
 *   how often a glance down led straight into speech (READING_PATTERN);
 * - what the microphone heard before recording: speaking while the question was
 *   on screen, as if reading it to a phone (SPEECH_DURING_PREP);
 * - what an AI saw in camera pictures: a phone, another person (AI_SNAPSHOT_FLAG);
 * - what the AI heard in the recording: few fillers, an even pace, pauses at
 *   full stops, textbook wording (DeliveryCheck from the scoring call).
 *
 * The result is a level with the reasons behind it. It never changes a score
 * and is never a reason on its own to reject someone: a person watches the video.
 */

import type { DeliveryCheck, ProctoringEvent } from './types';

export type ReadingLevel = 'low' | 'medium' | 'high' | 'unknown';

export interface ReadingCheck {
  level: ReadingLevel;
  reasons: string[];
  /** Moments in the video worth watching. */
  moments: { time: string; note: string }[];
}

const clampNum = (v: unknown, min: number, max: number): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : undefined;
};
const str = (v: unknown, max = 200): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const strList = (v: unknown, n = 6): string[] =>
  (Array.isArray(v) ? v : []).map((x) => str(x)).filter(Boolean).slice(0, n);
function oneOf<T extends string>(v: unknown, options: readonly T[]): T | undefined {
  return options.includes(v as T) ? (v as T) : undefined;
}

/** Whatever the model returned, turned into a safe DeliveryCheck, or undefined when there is nothing usable. */
export function cleanDeliveryCheck(raw: unknown): DeliveryCheck | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const verdict = oneOf(r.verdict, ['spontaneous', 'possibly_read', 'likely_read', 'unclear'] as const);
  if (!verdict) return undefined;
  const moments = (Array.isArray(r.moments) ? r.moments : [])
    .map((m) => (m && typeof m === 'object' ? m as Record<string, unknown> : {}))
    .map((m) => ({ time: str(m.time, 8), note: str(m.note, 160) }))
    .filter((m) => /^\d{1,2}:\d{2}$/.test(m.time) && m.note)
    .slice(0, 6);
  return {
    verdict,
    confidence: clampNum(r.confidence, 0, 100) ?? 0,
    reasons: strList(r.reasons),
    moments,
    fillers_per_minute: clampNum(r.fillers_per_minute, 0, 60),
    start_delay_seconds: clampNum(r.start_delay_seconds, 0, 600),
    pace: oneOf(r.pace, ['natural', 'very_even'] as const),
    wording: oneOf(r.wording, ['own_words', 'mixed', 'textbook_or_ai'] as const),
    matches_written_style: oneOf(r.matches_written_style, ['yes', 'no', 'unknown'] as const),
    room_notes: strList(r.room_notes, 4),
  };
}

/** Weigh every signal for one stage. */
export function readingCheckFor(events: ProctoringEvent[], delivery?: DeliveryCheck): ReadingCheck {
  let points = 0;
  let signals = 0;
  const reasons: string[] = [];

  if (delivery && delivery.verdict !== 'unclear') {
    signals++;
    if (delivery.verdict === 'likely_read') {
      points += delivery.confidence >= 60 ? 3 : 2;
      reasons.push(`The AI judged the answer as likely read out (${delivery.confidence}% sure).`);
    } else if (delivery.verdict === 'possibly_read') {
      points += 1.5;
      reasons.push(`The AI thought the answer may have been read out (${delivery.confidence}% sure).`);
    }
    if (delivery.verdict !== 'spontaneous') reasons.push(...delivery.reasons.slice(0, 3));
    if (delivery.wording === 'textbook_or_ai') {
      points += 1;
      reasons.push('The wording sounds like a textbook or an AI answer rather than the candidate’s own.');
    }
    if (delivery.matches_written_style === 'no') {
      points += 1;
      reasons.push('The spoken wording does not match how the candidate writes in the written stage.');
    }
    for (const note of delivery.room_notes ?? []) {
      points += 1;
      reasons.push(`Seen or heard in the recording: ${note}`);
    }
  }

  for (const e of events.filter((x) => x.event_type === 'READING_PATTERN')) {
    signals++;
    const pct = e.metrics?.eyes_away_speaking_pct ?? 0;
    const cycles = e.metrics?.glance_then_speak ?? 0;
    if (pct >= 40) points += 2;
    else if (pct >= 25) points += 1;
    if (cycles >= 8) points += 1;
    if (pct >= 25 || cycles >= 8) reasons.push(e.details);
  }

  const count = (t: ProctoringEvent['event_type']) => events.filter((e) => e.event_type === t).length;
  const prep = count('SPEECH_DURING_PREP');
  if (prep) { signals++; points += 1.5; reasons.push('Spoke aloud while the question was on screen, before recording started.'); }
  const snap = events.filter((e) => e.event_type === 'AI_SNAPSHOT_FLAG');
  if (snap.length) { signals++; points += 2; reasons.push(...snap.slice(0, 2).map((e) => e.details)); }
  const phone = count('PHONE_DETECTED');
  if (phone) { signals++; points += 2; reasons.push(`A phone or other device was seen on camera ${phone} time${phone === 1 ? '' : 's'}.`); }
  const script = count('READING_TELEPROMPTER_SUSPECTED');
  if (script) { points += 1; reasons.push('Eye movements like reading lines of text were seen.'); }
  const down = count('LOOKING_DOWN_AT_DEVICE');
  if (down) { points += Math.min(1.5, down * 0.5); reasons.push(`Looked down for long stretches ${down} time${down === 1 ? '' : 's'}.`); }
  if (count('MIC_OFF')) reasons.push('The microphone was off, so the voice checks could not run.');

  const level: ReadingLevel = signals === 0 && points === 0 ? 'unknown' : points >= 4 ? 'high' : points >= 2 ? 'medium' : 'low';
  return { level, reasons: [...new Set(reasons)].slice(0, 8), moments: delivery?.moments ?? [] };
}

export const READING_LEVEL_LABEL: Record<ReadingLevel, string> = {
  low: 'Low: sounds like their own words',
  medium: 'Medium: worth watching the video',
  high: 'High: likely read out',
  unknown: 'Not enough to judge',
};
