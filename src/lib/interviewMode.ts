/**
 * What a vacancy's applicants go through: the five-stage test, the spoken AI
 * interview, or both. The school picks it per vacancy; a candidate carries the
 * choice of the vacancy they applied for.
 */

import type { InterviewMode } from './types';

export const INTERVIEW_MODES: InterviewMode[] = ['five_stage', 'ai', 'both'];

export const MODE_LABEL: Record<InterviewMode, string> = {
  five_stage: 'Five-stage test',
  ai: 'AI conversational interview',
  both: 'Five-stage test and AI interview',
};

export const MODE_HELP: Record<InterviewMode, string> = {
  five_stage: 'Details and CV, a subject test, a recorded teaching demo, a classroom scenario and school policies. About 60 to 75 minutes, as today.',
  ai: 'Details and CV, then a structured 18-minute spoken interview with an AI interviewer, then school policies. No written test or recorded videos.',
  both: 'The full five-stage test, then the spoken AI interview. The most thorough, and the longest.',
};

export function cleanMode(v: unknown): InterviewMode | undefined {
  return INTERVIEW_MODES.includes(v as InterviewMode) ? (v as InterviewMode) : undefined;
}

export const modeOf = (x: { interview_mode?: InterviewMode } | null | undefined): InterviewMode => x?.interview_mode ?? 'five_stage';

/** The two plain-text lines an invitation message uses for each mode. */
export function inviteLength(mode: InterviewMode): string {
  if (mode === 'ai') return 'It takes about 40 minutes: a short profile with your CV, then a structured 18-minute spoken interview, then a short school policy step.';
  if (mode === 'both') return 'It takes about 90 minutes in all: the online test, then an 18-minute spoken interview. You can do it in more than one sitting.';
  return 'The online assessment takes about 60–75 minutes: a short profile, a written test, and two short videos.';
}

/** The steps a candidate takes, in order. 'ai_interview' is the spoken interview. */
export function stepsFor(mode: InterviewMode): string[] {
  const five = ['identity_verification', 'written_theory', 'micro_teaching_demo', 'situational_scenario', 'hr_policy_briefing'];
  if (mode === 'ai') return ['identity_verification', 'ai_interview', 'hr_policy_briefing'];
  if (mode === 'both') return [...five, 'ai_interview'];
  return five;
}
