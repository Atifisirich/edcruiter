import { describe, expect, it } from 'vitest';
import { calculateAuthenticityScore } from './proctoringEngine';
import { ProctoringEvent } from './types';

function event(event_type: ProctoringEvent['event_type']): ProctoringEvent {
  return {
    id: `proc_${Math.random()}`,
    school_id: 'school_1',
    candidate_id: 'cand_1',
    stage_key: 'written_theory',
    event_type,
    details: '',
    timestamp: new Date().toISOString()
  };
}

describe('calculateAuthenticityScore', () => {
  it('returns a perfect score with no events', () => {
    const result = calculateAuthenticityScore([]);
    expect(result.score).toBe(100);
    expect(result.label).toBe('High confidence');
    expect(result.violationCount).toBe(0);
  });

  it('does not penalise informational webcam snapshots', () => {
    const result = calculateAuthenticityScore([event('WEBCAM_SNAPSHOT'), event('WEBCAM_SNAPSHOT')]);
    expect(result.score).toBe(100);
    expect(result.violationCount).toBe(0);
  });

  it('weighs a serious violation more heavily than a minor one', () => {
    const minor = calculateAuthenticityScore([event('FACE_NOT_DETECTED')]);
    const serious = calculateAuthenticityScore([event('PHONE_DETECTED')]);
    expect(serious.score).toBeLessThan(minor.score);
  });

  it('never drops below zero even with many violations', () => {
    const events = Array.from({ length: 10 }, () => event('MULTI_FACE_DETECTED'));
    const result = calculateAuthenticityScore(events);
    expect(result.score).toBe(0);
    expect(result.label).toBe('Low confidence');
  });

  it('labels a handful of minor flags as mostly authentic, not a clean record', () => {
    const result = calculateAuthenticityScore([event('TAB_SWITCH'), event('TAB_SWITCH')]);
    expect(result.score).toBe(84);
    expect(result.label).toBe('Mostly authentic');
  });
});
