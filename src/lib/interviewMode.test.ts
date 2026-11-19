import { describe, expect, it } from 'vitest';
import { cleanMode, inviteLength, modeOf, stepsFor } from './interviewMode';
import { candidateState, stepsOf } from './candidateProgress';

const base = { status: 'in_progress' as const, shortlist_status: undefined, current_stage_key: 'identity_verification' as const, selected_at: undefined, rejected_by_school_at: undefined, rejected_by_candidate_at: undefined };

describe('the interview choice', () => {
  it('accepts only the three known choices', () => {
    expect(cleanMode('ai')).toBe('ai');
    expect(cleanMode('both')).toBe('both');
    expect(cleanMode('five_stage')).toBe('five_stage');
    expect(cleanMode('nonsense')).toBeUndefined();
    expect(cleanMode(undefined)).toBeUndefined();
  });
  it('is the five-stage test when nothing was chosen', () => {
    expect(modeOf(undefined)).toBe('five_stage');
    expect(modeOf({})).toBe('five_stage');
  });
  it('says a different length in each invitation', () => {
    expect(inviteLength('five_stage')).toMatch(/60–75/);
    expect(inviteLength('ai')).toMatch(/12-minute spoken/);
    expect(inviteLength('both')).toMatch(/90 minutes/);
  });
  it('has the right steps in order', () => {
    expect(stepsFor('five_stage')).toHaveLength(5);
    expect(stepsFor('ai')).toEqual(['identity_verification', 'ai_interview', 'hr_policy_briefing']);
    expect(stepsFor('both').slice(-1)).toEqual(['ai_interview']);
    expect(stepsFor('both')).toHaveLength(6);
  });
});

describe('progress follows the choice', () => {
  it('counts three steps for the AI path, and is ready only when all three are done', () => {
    const c = { ...base, interview_mode: 'ai' as const };
    expect(stepsOf({ ...c, done_keys: ['identity_verification'] })).toEqual({ done: 1, total: 3 });
    expect(candidateState({ ...c, done_keys: ['identity_verification', 'hr_policy_briefing'] }).tab).toBe('in_progress');
    const done = candidateState({ ...c, done_keys: ['identity_verification', 'hr_policy_briefing'], ai_interview_status: 'completed' });
    expect(done.tab).toBe('ready');
    expect(done.stepsTotal).toBe(3);
  });
  it('is not ready on the AI path until the interview is taken, whatever else is done', () => {
    expect(candidateState({ ...base, interview_mode: 'ai', done_keys: ['identity_verification', 'hr_policy_briefing'], ai_interview_status: 'in_progress' }).tab).toBe('in_progress');
  });
  it('needs the interview after the five stages when both are chosen', () => {
    const all = ['identity_verification', 'written_theory', 'micro_teaching_demo', 'situational_scenario', 'hr_policy_briefing'];
    expect(candidateState({ ...base, interview_mode: 'both', done_keys: all }).tab).toBe('in_progress');
    expect(candidateState({ ...base, interview_mode: 'both', done_keys: all, ai_interview_status: 'completed' }).tab).toBe('ready');
  });
  it('leaves the five-stage test exactly as it was', () => {
    expect(stepsOf({ ...base, stages_completed: 2 })).toEqual({ done: 2, total: 5 });
    expect(candidateState({ ...base, stages_completed: 2 }).label).toBe('Stage 3 of 5');
    expect(candidateState({ ...base, stages_completed: 5 }).tab).toBe('ready');
  });
});
