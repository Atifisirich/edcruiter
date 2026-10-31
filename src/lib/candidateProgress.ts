/**
 * Where a candidate stands, in plain words, for the hiring dashboard: how far
 * through the five-stage test they are, and which tab of the candidate list
 * they belong in. Pure, so it is tested without a page.
 */

import type { Candidate } from './types';

export const TEST_STAGE_COUNT = 5;

export type CandidateTab = 'in_progress' | 'ready' | 'shortlisted' | 'selected' | 'rejected';
export type StatusTone = 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose';

export interface CandidateState {
  tab: CandidateTab;
  label: string;
  tone: StatusTone;
  stagesDone: number;
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
> & { stages_completed?: number };

/** How many of the five stages the candidate has finished. */
export function stagesDone(c: Pick<ProgressInput, 'stages_completed' | 'current_stage_key'>): number {
  if (typeof c.stages_completed === 'number') return Math.max(0, Math.min(TEST_STAGE_COUNT, c.stages_completed));
  // Older rows: the stage they are on is the one after those they finished.
  return STAGE_INDEX[c.current_stage_key] ?? 0;
}

export function candidateState(c: ProgressInput): CandidateState {
  const done = stagesDone(c);

  if (c.status === 'hired' || c.selected_at) {
    return { tab: 'selected', label: 'Selected', tone: 'emerald', stagesDone: done };
  }
  if (c.status === 'rejected' || c.rejected_by_school_at || c.rejected_by_candidate_at) {
    return {
      tab: 'rejected',
      label: c.rejected_by_candidate_at ? 'Withdrew' : 'Not moving forward',
      tone: 'rose',
      stagesDone: done,
    };
  }
  if (c.status === 'passed' || c.shortlist_status === 'shortlisted') {
    return { tab: 'shortlisted', label: 'Shortlisted', tone: 'indigo', stagesDone: done };
  }
  if (done >= TEST_STAGE_COUNT) {
    return { tab: 'ready', label: 'Ready to review', tone: 'amber', stagesDone: done };
  }
  return {
    tab: 'in_progress',
    label: done === 0 ? 'Invited' : `Stage ${done + 1} of ${TEST_STAGE_COUNT}`,
    tone: 'slate',
    stagesDone: done,
  };
}

export function countByTab(candidates: ProgressInput[]): Record<CandidateTab, number> {
  const counts: Record<CandidateTab, number> = { in_progress: 0, ready: 0, shortlisted: 0, selected: 0, rejected: 0 };
  for (const c of candidates) counts[candidateState(c).tab] += 1;
  return counts;
}
