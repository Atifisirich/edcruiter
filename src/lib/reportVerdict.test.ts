import { describe, expect, it } from 'vitest';
import {
  countTone, cvTone, firstSentence, groupEvents, integrityTone, redFlags, stageScore100, summariseFactors, toneFor100, topLists, verdictFor,
} from './reportVerdict';

describe('verdictFor', () => {
  it('maps the headline score to one word', () => {
    expect(verdictFor(85)?.key).toBe('strong');
    expect(verdictFor(80)?.key).toBe('strong');
    expect(verdictFor(79)?.key).toBe('good');
    expect(verdictFor(60)?.key).toBe('good');
    expect(verdictFor(59)?.key).toBe('mixed');
    expect(verdictFor(41)?.key).toBe('mixed');
    expect(verdictFor(40)?.key).toBe('weak');
    expect(verdictFor(null)).toBeNull();
  });

  it('holds a high score at Mixed when the CV does not meet the vacancy or the score was capped', () => {
    const v = verdictFor(90, { notEligible: true });
    expect(v?.key).toBe('mixed');
    expect(v?.heldBack).toBeTruthy();
    expect(verdictFor(90, { cappedReason: 'Refused to answer' })?.heldBack).toBe('Refused to answer');
    // A low score is never lifted.
    expect(verdictFor(20, { notEligible: true })?.key).toBe('weak');
  });
});

describe('tones', () => {
  it('uses the report bands for scores out of 100', () => {
    expect(toneFor100(80)).toBe('good');
    expect(toneFor100(41)).toBe('watch');
    expect(toneFor100(40)).toBe('concern');
    expect(toneFor100(null)).toBe('none');
  });

  it('marks a CV that does not meet the vacancy as a concern whatever its score', () => {
    expect(cvTone({ overall_fitment_score: 9, eligibility_verdict: 'eligible' })).toBe('good');
    expect(cvTone({ overall_fitment_score: 6 })).toBe('watch');
    expect(cvTone({ overall_fitment_score: 9, eligibility_verdict: 'not_eligible' })).toBe('concern');
    expect(cvTone(null)).toBe('none');
  });

  it('counts', () => {
    expect(countTone(0)).toBe('good');
    expect(countTone(2)).toBe('watch');
    expect(countTone(3)).toBe('concern');
  });

  it('treats any serious proctoring event as a concern and ignores camera pictures', () => {
    expect(integrityTone([{ event_type: 'WEBCAM_SNAPSHOT' }])).toBe('good');
    expect(integrityTone([{ event_type: 'TAB_SWITCH' }])).toBe('watch');
    expect(integrityTone([{ event_type: 'IDENTITY_MISMATCH' }], 95)).toBe('concern');
    expect(integrityTone([{ event_type: 'TAB_SWITCH' }], 90)).toBe('good');
  });
});

describe('groupEvents', () => {
  it('counts by type, serious ones first', () => {
    const g = groupEvents([
      { event_type: 'TAB_SWITCH' }, { event_type: 'TAB_SWITCH' }, { event_type: 'PHONE_DETECTED' }, { event_type: 'WEBCAM_SNAPSHOT' },
    ]);
    expect(g.map((x) => [x.type, x.count])).toEqual([['PHONE_DETECTED', 1], ['TAB_SWITCH', 2]]);
  });
});

describe('text helpers', () => {
  it('keeps the first sentence', () => {
    expect(firstSentence('Clear explainer. Needs work on pace.')).toBe('Clear explainer.');
    expect(firstSentence('')).toBe('');
    expect(firstSentence('a'.repeat(300), 50)).toHaveLength(50);
  });

  it('averages stage dimensions out of 100', () => {
    expect(stageScore100({ ai_scores: { scores: [{ dimension: 'a', score: 7 }, { dimension: 'b', score: 8 }] } } as never)).toBe(75);
    expect(stageScore100({})).toBeNull();
  });
});

describe('topLists', () => {
  it('puts hard stops first, removes repeats and keeps three of each', () => {
    const { strengths, concerns } = topLists({
      profileStrengths: ['Explains fractions clearly', 'Warm with students'],
      profileImprovements: ['Pacing is slow'],
      interview: { strengths: ['Explains fractions clearly with examples'], concerns: ['Pacing is slow in class'], flags: ['Read answers from a screen'] },
      resume: { green_flags: ['Ten years in CBSE schools'], red_flags: ['Gap in 2021'], eligibility_verdict: 'not_eligible', eligibility_summary: 'No B.Ed.', pedagogical_highlights: [], form_vs_cv_discrepancies: [] },
    });
    expect(strengths).toEqual(['Explains fractions clearly', 'Warm with students', 'Ten years in CBSE schools']);
    expect(concerns).toEqual(['No B.Ed.', 'Read answers from a screen', 'Pacing is slow']);
  });

  it('lists every red flag once', () => {
    expect(redFlags({ resume: { red_flags: ['No B.Ed.', 'No B.Ed'], eligibility_verdict: 'eligible', green_flags: [], pedagogical_highlights: [] }, interview: null })).toEqual(['No B.Ed.']);
  });
});

describe('summariseFactors', () => {
  it('averages scored factors and names the best and weakest', () => {
    const s = summariseFactors([
      { label: 'A', score: 80, confidence: 'high' },
      { label: 'B', score: 60, confidence: 'high' },
      { label: 'C', score: 90, confidence: 'none' },
      { label: 'D', score: null },
    ]);
    expect(s).toEqual({ average: 70, scored: 2, total: 4, best: { label: 'A', score: 80 }, weakest: { label: 'B', score: 60 } });
  });

  it('has no average when nothing is scored, and no weakest for a single factor', () => {
    expect(summariseFactors([{ label: 'A', score: null }]).average).toBeNull();
    expect(summariseFactors([{ label: 'A', score: 50 }]).weakest).toBeUndefined();
  });
});
