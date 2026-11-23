import { describe, expect, it } from 'vitest';
import { cleanDeliveryCheck, readingCheckFor } from './readingCheck';
import { ReadingTracker, VoiceActivity } from './readingTracker';
import { findingSummary, parseFinding } from './snapshotReview';
import { calculateAuthenticityScore } from './proctoringEngine';
import type { ProctoringEvent } from './types';

const ev = (event_type: ProctoringEvent['event_type'], details = '', metrics?: Record<string, number>): ProctoringEvent => ({
  id: Math.random().toString(36), school_id: 's', candidate_id: 'c', stage_key: 'situational_scenario',
  event_type, details, metrics, timestamp: new Date().toISOString(),
});

describe('cleanDeliveryCheck', () => {
  it('keeps a valid answer and drops junk', () => {
    const d = cleanDeliveryCheck({
      verdict: 'likely_read', confidence: 140, reasons: ['few fillers', 7, ''],
      moments: [{ time: '1:05', note: 'eyes drop' }, { time: 'soon', note: 'x' }],
      pace: 'robotic', wording: 'textbook_or_ai', room_notes: 'not a list',
    });
    expect(d?.confidence).toBe(100);
    expect(d?.reasons).toEqual(['few fillers', '7']);
    expect(d?.moments).toEqual([{ time: '1:05', note: 'eyes drop' }]);
    expect(d?.pace).toBeUndefined();
    expect(d?.room_notes).toEqual([]);
  });
  it('returns nothing without a known verdict', () => {
    expect(cleanDeliveryCheck({ verdict: 'maybe' })).toBeUndefined();
    expect(cleanDeliveryCheck(null)).toBeUndefined();
  });
});

describe('readingCheckFor', () => {
  it('is unknown with no signals at all', () => {
    expect(readingCheckFor([]).level).toBe('unknown');
  });
  it('is low for a natural answer', () => {
    const d = cleanDeliveryCheck({ verdict: 'spontaneous', confidence: 80, reasons: [], moments: [] });
    expect(readingCheckFor([ev('READING_PATTERN', 'calm', { eyes_away_speaking_pct: 10, glance_then_speak: 2 })], d).level).toBe('low');
  });
  it('is high when the AI and the camera agree', () => {
    const d = cleanDeliveryCheck({ verdict: 'likely_read', confidence: 75, reasons: ['even pace'], moments: [] });
    const r = readingCheckFor([ev('READING_PATTERN', 'eyes away 55%', { eyes_away_speaking_pct: 55, glance_then_speak: 12 })], d);
    expect(r.level).toBe('high');
    expect(r.reasons).toContain('eyes away 55%');
  });
  it('is medium on camera evidence alone', () => {
    expect(readingCheckFor([ev('READING_PATTERN', 'x', { eyes_away_speaking_pct: 45, glance_then_speak: 3 })]).level).toBe('medium');
  });
});

describe('ReadingTracker', () => {
  it('measures eyes away while speaking and glance-then-speak starts', () => {
    const t = new ReadingTracker();
    let now = 0;
    // Five cycles: 600 ms silent looking down, then 1 s speaking looking up.
    for (let c = 0; c < 5; c++) {
      for (let i = 0; i < 6; i++) { t.feed(now, true, false); now += 100; }
      for (let i = 0; i < 10; i++) { t.feed(now, false, true); now += 100; }
    }
    const s = t.summary();
    expect(s.glance_then_speak).toBe(5);
    expect(s.eyes_away_speaking_pct).toBe(0);
    expect(s.speaking_seconds).toBe(5);
  });
  it('counts reading straight off a phone', () => {
    const t = new ReadingTracker();
    for (let i = 0; i < 200; i++) t.feed(i * 100, i % 10 < 7, true);
    expect(t.summary().eyes_away_speaking_pct).toBe(70);
  });
});

describe('VoiceActivity', () => {
  it('ignores steady background noise and hears speech', () => {
    const v = new VoiceActivity();
    let t = 0;
    for (let i = 0; i < 100; i++) { v.update(0.008, t); t += 60; }
    expect(v.update(0.008, t)).toBe(false);
    expect(v.update(0.08, (t += 60))).toBe(true);
    expect(v.update(0.008, (t += 60))).toBe(true); // holds between syllables
    expect(v.update(0.008, (t += 600))).toBe(false);
  });
});

describe('snapshot review', () => {
  it('reads the model reply and summarises findings', () => {
    const f = parseFinding('```json\n{"phone_or_device": true, "other_person": "yes", "note": "phone in left hand"}\n```');
    expect(f?.phone_or_device).toBe(true);
    expect(f?.other_person).toBe(false);
    expect(findingSummary(f!)).toBe('a phone or other device. phone in left hand');
    expect(findingSummary(parseFinding('{}')!)).toBeNull();
    expect(parseFinding('not json')).toBeNull();
  });
});

describe('authenticity score', () => {
  it('does not count summaries or question peeks', () => {
    expect(calculateAuthenticityScore([ev('READING_PATTERN'), ev('QUESTION_REVIEWED')]).score).toBe(100);
    expect(calculateAuthenticityScore([ev('AI_SNAPSHOT_FLAG')]).score).toBe(85);
  });
});
