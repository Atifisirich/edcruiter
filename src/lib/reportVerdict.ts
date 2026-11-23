/**
 * How the candidate report reads at a glance: one verdict word, a tone for every
 * number, and the few strengths and concerns worth reading first. Presentation
 * only. Every score shown here is computed elsewhere and never changed.
 */
import type { AiInterviewReport, ProctoringEvent, ResumeAnalysisReport, StageResult } from './types';
import { scoreTone } from './teachingProfile';
import { dedupeSimilar } from './reportText';

/** good: no action. watch: worth a look. concern: read before deciding. none: no data or not judged. */
export type MetricTone = 'good' | 'watch' | 'concern' | 'none';

export type VerdictKey = 'strong' | 'good' | 'mixed' | 'weak';

export interface Verdict {
  key: VerdictKey;
  label: string;
  /** What a recruiter would usually do next. A suggestion, never the decision. */
  nextStep: string;
  /** Why the verdict sits below what the number alone would give. */
  heldBack?: string;
}

const VERDICTS: Record<VerdictKey, Omit<Verdict, 'key' | 'heldBack'>> = {
  strong: { label: 'Strong', nextStep: 'Shortlist and book the next round.' },
  good: { label: 'Good', nextStep: 'Shortlist. Use the questions below to probe the gaps.' },
  mixed: { label: 'Mixed', nextStep: 'Hold. Check the concerns in a short call before deciding.' },
  weak: { label: 'Weak', nextStep: 'Unlikely fit. Reject unless the concerns are explained.' },
};

/** Tone for a 0 to 100 score, on the same bands as the rest of the report (80+, 41 to 79, 40 and below). */
export function toneFor100(score: number | null | undefined): MetricTone {
  if (score === null || score === undefined || Number.isNaN(score)) return 'none';
  const t = scoreTone(score);
  return t === 'green' ? 'good' : t === 'yellow' ? 'watch' : 'concern';
}

/** Tone for the CV fit, scored 1 to 10. A CV that does not meet the vacancy is always a concern. */
export function cvTone(resume?: Pick<ResumeAnalysisReport, 'overall_fitment_score' | 'eligibility_verdict'> | null): MetricTone {
  if (!resume || typeof resume.overall_fitment_score !== 'number') return 'none';
  if (resume.eligibility_verdict === 'not_eligible') return 'concern';
  if (resume.overall_fitment_score >= 8) return 'good';
  if (resume.overall_fitment_score >= 5) return 'watch';
  return 'concern';
}

export function countTone(count: number): MetricTone {
  if (count <= 0) return 'good';
  if (count <= 2) return 'watch';
  return 'concern';
}

/**
 * The verdict word for the headline score: Strong 80+, Good 60 to 79, Mixed 41 to 59, Weak 40 and below.
 * A CV that does not meet the vacancy, or a score capped for misconduct, holds it at Mixed or below.
 */
export function verdictFor(
  score: number | null,
  opts: { notEligible?: boolean; cappedReason?: string } = {},
): Verdict | null {
  if (score === null || Number.isNaN(score)) return null;
  let key: VerdictKey = score >= 80 ? 'strong' : score >= 60 ? 'good' : score >= 41 ? 'mixed' : 'weak';
  let heldBack: string | undefined;
  if ((opts.notEligible || opts.cappedReason) && (key === 'strong' || key === 'good')) {
    key = 'mixed';
    heldBack = opts.cappedReason || 'Held at Mixed because the CV does not meet the vacancy.';
  }
  return { key, ...VERDICTS[key], ...(heldBack ? { heldBack } : {}) };
}

/** The first sentence, so the summary fits on one line. */
export function firstSentence(text: string | undefined | null, max = 220): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const match = clean.match(/^.+?[.!?](?=\s|$)/);
  const sentence = match ? match[0] : clean;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

/** A stage's score out of 100: the mean of its AI dimension scores (each out of 10). */
export function stageScore100(result?: Pick<StageResult, 'ai_scores'>): number | null {
  const dims = result?.ai_scores?.scores;
  if (!dims?.length) return null;
  const avg = dims.reduce((sum, d) => sum + (Number(d.score) || 0), 0) / dims.length;
  return Math.round(avg * 10);
}

/** Plain names for proctoring events. */
export const EVENT_LABEL: Record<string, string> = {
  TAB_SWITCH: 'Left the test tab',
  FULLSCREEN_EXIT: 'Left full screen',
  TIMEOUT: 'Ran out of time',
  WEBCAM_SNAPSHOT: 'Camera picture',
  COPY_PASTE_ATTEMPT: 'Tried to copy or paste',
  GAZE_OFF_SCREEN: 'Looked away from the screen',
  LOOKING_DOWN_AT_DEVICE: 'Looked down, as if at a phone',
  PHONE_DETECTED: 'Phone seen on camera',
  READING_TELEPROMPTER_SUSPECTED: 'Seemed to read the answer',
  VOICE_PROCTOR_WARNING: 'Another voice heard',
  MULTI_FACE_DETECTED: 'More than one face',
  FACE_NOT_DETECTED: 'Face not on camera',
  IDENTITY_MISMATCH: 'A different person',
};

export function eventLabel(type: string): string {
  return EVENT_LABEL[type] || type.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/** Events that point at someone else taking the test, or help on camera. */
const SERIOUS_EVENTS = new Set(['IDENTITY_MISMATCH', 'MULTI_FACE_DETECTED', 'PHONE_DETECTED', 'VOICE_PROCTOR_WARNING']);

/** Camera pictures are kept as evidence, not as flags. */
export function flagEvents<T extends Pick<ProctoringEvent, 'event_type'>>(events: T[]): T[] {
  return events.filter((e) => e.event_type !== 'WEBCAM_SNAPSHOT');
}

/** Counts by event type, most frequent first. */
export function groupEvents(events: Pick<ProctoringEvent, 'event_type'>[]): { type: string; label: string; count: number; serious: boolean }[] {
  const counts = new Map<string, number>();
  for (const e of flagEvents(events)) counts.set(e.event_type, (counts.get(e.event_type) || 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, label: eventLabel(type), count, serious: SERIOUS_EVENTS.has(type) }))
    .sort((a, b) => Number(b.serious) - Number(a.serious) || b.count - a.count);
}

/** Integrity tone: any serious event is a concern; a few minor ones are worth a look. */
export function integrityTone(events: Pick<ProctoringEvent, 'event_type'>[], integrityScore?: number | null): MetricTone {
  const flags = flagEvents(events);
  if (flags.some((e) => SERIOUS_EVENTS.has(e.event_type))) return 'concern';
  if (typeof integrityScore === 'number') return toneFor100(integrityScore);
  if (flags.length === 0) return 'good';
  return flags.length <= 5 ? 'watch' : 'concern';
}

export interface TopListsInput {
  profileStrengths?: string[];
  profileImprovements?: string[];
  cappedReason?: string;
  interview?: Pick<AiInterviewReport, 'strengths' | 'concerns' | 'flags'> | null;
  resume?: Pick<ResumeAnalysisReport, 'green_flags' | 'red_flags' | 'pedagogical_highlights' | 'eligibility_verdict' | 'eligibility_summary' | 'form_vs_cv_discrepancies'> | null;
  limit?: number;
}

/**
 * The few strengths and concerns to read first, from every source, with near
 * duplicates removed. Hard stops (a capped score, a CV that does not meet the
 * vacancy, interview flags) come before ordinary concerns.
 */
export function topLists(input: TopListsInput): { strengths: string[]; concerns: string[] } {
  const limit = input.limit ?? 3;
  const strengths = dedupeSimilar([
    ...(input.profileStrengths ?? []),
    ...(input.interview?.strengths ?? []),
    ...(input.resume?.green_flags ?? []),
    ...(input.resume?.pedagogical_highlights ?? []),
  ]);
  const concerns = dedupeSimilar([
    ...(input.cappedReason ? [input.cappedReason] : []),
    ...(input.resume?.eligibility_verdict === 'not_eligible'
      ? [input.resume.eligibility_summary || 'The CV does not meet the requirements set for this vacancy.']
      : []),
    ...(input.interview?.flags ?? []),
    ...(input.profileImprovements ?? []),
    ...(input.interview?.concerns ?? []),
    ...(input.resume?.form_vs_cv_discrepancies ?? []),
    ...(input.resume?.red_flags ?? []),
  ]);
  return { strengths: strengths.slice(0, limit), concerns: concerns.slice(0, limit) };
}

/** Every red flag from the CV and the interview, with near duplicates removed. */
export function redFlags(input: Pick<TopListsInput, 'resume' | 'interview' | 'cappedReason'>): string[] {
  return dedupeSimilar([
    ...(input.cappedReason ? [input.cappedReason] : []),
    ...(input.resume?.eligibility_verdict === 'not_eligible'
      ? [input.resume.eligibility_summary || 'The CV does not meet the requirements set for this vacancy.']
      : []),
    ...(input.interview?.flags ?? []),
    ...(input.resume?.form_vs_cv_discrepancies ?? []),
    ...(input.resume?.red_flags ?? []),
  ]);
}

export interface FactorSummary {
  /** Mean of the factors that have a score, rounded. Null when none do. */
  average: number | null;
  scored: number;
  total: number;
  best?: { label: string; score: number };
  weakest?: { label: string; score: number };
}

/** One line for a group of factors: its average, and its best and weakest factor. */
export function summariseFactors(factors: { label: string; score: number | null; confidence?: string }[]): FactorSummary {
  const scored = factors
    .filter((f): f is { label: string; score: number; confidence?: string } => typeof f.score === 'number' && f.confidence !== 'none')
    .map((f) => ({ label: f.label, score: f.score }));
  if (!scored.length) return { average: null, scored: 0, total: factors.length };
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return {
    average: Math.round(scored.reduce((s, f) => s + f.score, 0) / scored.length),
    scored: scored.length,
    total: factors.length,
    best: sorted[0],
    weakest: sorted.length > 1 ? sorted[sorted.length - 1] : undefined,
  };
}
