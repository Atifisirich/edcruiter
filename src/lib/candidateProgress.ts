/**
 * Where a candidate stands, in plain words, for the hiring dashboard: how far
 * through the five-stage test they are, and which tab of the candidate list
 * they belong in. Pure, so it is tested without a page.
 */

import type { Candidate, InterviewMode } from './types';
import { stepsFor } from './interviewMode';

export const TEST_STAGE_COUNT = 5;

export type CandidateTab = 'in_progress' | 'ready' | 'shortlisted' | 'selected' | 'rejected';
export type StatusTone = 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose';

export interface CandidateState {
  tab: CandidateTab;
  label: string;
  tone: StatusTone;
  /** Steps finished, out of stepsTotal. For the five-stage test these are the five stages. */
  stagesDone: number;
  stepsTotal: number;
}

export const TAB_LABEL: Record<CandidateTab, string> = {
  in_progress: 'In progress',
  ready: 'Ready to review',
  shortlisted: 'Shortlisted',
  selected: 'Selected',
  rejected: 'Not moving forward',
};

export const TAB_ORDER: CandidateTab[] = ['in_progress', 'ready', 'shortlisted', 'selected', 'rejected'];

const STAGE_INDEX: Record<string, number> = {
  identity_verification: 0,
  written_theory: 1,
  micro_teaching_demo: 2,
  situational_scenario: 3,
  hr_policy_briefing: 4,
};

type ProgressInput = Pick<
  Candidate,
  'status' | 'shortlist_status' | 'current_stage_key' | 'selected_at' | 'rejected_by_school_at' | 'rejected_by_candidate_at'
> & {
  stages_completed?: number;
  /** Which stages have a saved result. With interview_mode, lets progress follow the vacancy's choice. */
  done_keys?: string[];
  interview_mode?: InterviewMode;
  ai_interview_status?: string;
};

/** How many of the five stages the candidate has finished. */
export function stagesDone(c: Pick<ProgressInput, 'stages_completed' | 'current_stage_key'>): number {
  if (typeof c.stages_completed === 'number') return Math.max(0, Math.min(TEST_STAGE_COUNT, c.stages_completed));
  // Older rows: the stage they are on is the one after those they finished.
  return STAGE_INDEX[c.current_stage_key] ?? 0;
}

/** Steps finished and steps in all, following the interview the vacancy chose. */
export function stepsOf(c: ProgressInput): { done: number; total: number } {
  const mode = c.interview_mode ?? 'five_stage';
  if (mode === 'five_stage' || !c.done_keys) return { done: stagesDone(c), total: TEST_STAGE_COUNT };
  const steps = stepsFor(mode);
  const finished = (k: string) => (k === 'ai_interview' ? c.ai_interview_status === 'completed' : c.done_keys!.includes(k));
  return { done: steps.filter(finished).length, total: steps.length };
}

export function candidateState(c: ProgressInput): CandidateState {
  const { done, total } = stepsOf(c);

  if (c.status === 'hired' || c.selected_at) {
    return { tab: 'selected', label: 'Selected', tone: 'emerald', stagesDone: done, stepsTotal: total };
  }
  if (c.status === 'rejected' || c.rejected_by_school_at || c.rejected_by_candidate_at) {
    return {
      tab: 'rejected',
      label: c.rejected_by_candidate_at ? 'Withdrew' : 'Not moving forward',
      tone: 'rose',
      stagesDone: done,
      stepsTotal: total,
    };
  }
  if (c.status === 'passed' || c.shortlist_status === 'shortlisted') {
    return { tab: 'shortlisted', label: 'Shortlisted', tone: 'indigo', stagesDone: done, stepsTotal: total };
  }
  if (c.shortlist_status === 'hold') {
    return { tab: 'ready', label: 'On hold', tone: 'amber', stagesDone: done, stepsTotal: total };
  }
  if (done >= total) {
    return { tab: 'ready', label: 'Ready to review', tone: 'amber', stagesDone: done, stepsTotal: total };
  }
  return {
    tab: 'in_progress',
    label: done === 0 ? 'Invited' : `${(c.interview_mode ?? 'five_stage') === 'five_stage' ? 'Stage' : 'Step'} ${done + 1} of ${total}`,
    tone: 'slate',
    stagesDone: done,
      stepsTotal: total,
  };
}

export function countByTab(candidates: ProgressInput[]): Record<CandidateTab, number> {
  const counts: Record<CandidateTab, number> = { in_progress: 0, ready: 0, shortlisted: 0, selected: 0, rejected: 0 };
  for (const c of candidates) counts[candidateState(c).tab] += 1;
  return counts;
}
