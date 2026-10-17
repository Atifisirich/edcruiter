import { StageKey } from './types';

export const SCORED_STAGE_KEYS: StageKey[] = [
  'written_theory',
  'micro_teaching_demo',
  'situational_scenario'
];

export function isScoredStage(stageKey: string | undefined | null): boolean {
  return !!stageKey && SCORED_STAGE_KEYS.includes(stageKey as StageKey);
}
