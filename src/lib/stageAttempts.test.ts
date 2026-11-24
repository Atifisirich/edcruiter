import { describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS, RESUME_WINDOW_MS, canStart, decideAttempt, nextStageToTake, routeOf, sinceText, stageBefore,
} from './stageAttempts';
import type { StageAttempt } from './types';

const NOW = Date.parse('2026-11-01T10:00:00Z');
const attempt = (number: number, status: StageAttempt['status'], minutesAgo: number): StageAttempt => ({
  id: `a${number}`, school_id: 's', candidate_id: 'c', stage_key: 'written_theory', number, status,
  started_at: new Date(NOW - 60 * 60_000).toISOString(),
  last_seen_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
});

describe('opening a stage', () => {
  it('starts the first go when there is none', () => {
    expect(decideAttempt([], NOW)).toEqual({ kind: 'new', number: 1, abandon: [] });
  });

  it('carries on with the same go when the page was open a moment ago (a refresh)', () => {
    const open = attempt(1, 'open', 1);
    expect(decideAttempt([open], NOW)).toEqual({ kind: 'resume', attempt: open });
  });

  it('closes a go left for a while and starts the next, with new questions', () => {
    const left = attempt(1, 'open', RESUME_WINDOW_MS / 60_000 + 5);
    expect(decideAttempt([left], NOW)).toEqual({ kind: 'new', number: 2, abandon: [left] });
  });

  it('counts goes already closed when numbering the next', () => {
    const d = decideAttempt([attempt(1, 'abandoned', 500), attempt(2, 'open', 300)], NOW);
    expect(d.kind).toBe('new');
    if (d.kind === 'new') expect(d.number).toBe(3);
  });

  it('stops when every go is used, and lets the school allow more', () => {
    const used = Array.from({ length: MAX_ATTEMPTS }, (_, i) => attempt(i + 1, 'abandoned', 1000));
    expect(decideAttempt(used, NOW)).toEqual({ kind: 'blocked', used: MAX_ATTEMPTS, allowed: MAX_ATTEMPTS });
    expect(decideAttempt(used, NOW, MAX_ATTEMPTS + 1).kind).toBe('new');
  });

  it('still resumes the open go even when all goes are used', () => {
    const goes = [attempt(1, 'abandoned', 900), attempt(2, 'abandoned', 800), attempt(3, 'open', 0.5)];
    expect(decideAttempt(goes, NOW).kind).toBe('resume');
  });
});

describe('the order of the stages', () => {
  it('needs every earlier stage finished', () => {
    expect(canStart('identity_verification', [])).toBe(true);
    expect(canStart('written_theory', [])).toBe(false);
    expect(canStart('written_theory', ['identity_verification'])).toBe(true);
    expect(canStart('situational_scenario', ['identity_verification', 'written_theory'])).toBe(false);
    expect(canStart('hr_policy_briefing', ['identity_verification', 'written_theory', 'micro_teaching_demo', 'situational_scenario'])).toBe(true);
  });

  it('follows the AI-interview route: profile, spoken interview, then school policies', () => {
    const ai = (interviewDone: boolean) => ({ mode: 'ai' as const, interviewDone });
    // A candidate who finished the profile and the interview can take the policy step (the five-stage middle is not asked for).
    expect(canStart('hr_policy_briefing', ['identity_verification'], ai(true))).toBe(true);
    // Not before the interview, and not before the profile.
    expect(canStart('hr_policy_briefing', ['identity_verification'], ai(false))).toBe(false);
    expect(canStart('hr_policy_briefing', [], ai(true))).toBe(false);
    // The written test is not part of this route at all.
    expect(canStart('written_theory', ['identity_verification'], ai(true))).toBe(false);
    // The five-stage route is unchanged.
    expect(canStart('hr_policy_briefing', ['identity_verification'], { mode: 'five_stage', interviewDone: true })).toBe(false);
    // Both: the five stages, then the interview.
    expect(canStart('hr_policy_briefing', ['identity_verification', 'written_theory', 'micro_teaching_demo', 'situational_scenario'], { mode: 'both', interviewDone: false })).toBe(true);
    expect(routeOf({ interview_mode: 'ai', ai_interview: { status: 'completed' } as never })).toEqual({ mode: 'ai', interviewDone: true });
    expect(routeOf({})).toEqual({ mode: 'five_stage', interviewDone: false });
  });

  it('names the stage before and the next to take', () => {
    expect(stageBefore('written_theory')).toBe('identity_verification');
    expect(stageBefore('identity_verification')).toBeNull();
    expect(nextStageToTake(['identity_verification', 'written_theory'])).toBe('micro_teaching_demo');
    expect(nextStageToTake(['identity_verification', 'written_theory', 'micro_teaching_demo', 'situational_scenario', 'hr_policy_briefing'])).toBeNull();
  });
});

describe('how long ago', () => {
  it('says minutes, hours or days in plain words', () => {
    const at = (m: number) => new Date(NOW - m * 60_000).toISOString();
    expect(sinceText(at(1), NOW)).toBe('1 minute');
    expect(sinceText(at(14), NOW)).toBe('14 minutes');
    expect(sinceText(at(180), NOW)).toBe('3 hours');
    expect(sinceText(at(60 * 24 * 4), NOW)).toBe('4 days');
  });
});
