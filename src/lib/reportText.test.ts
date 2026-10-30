import { describe, expect, it } from 'vitest';
import { cleanResumeReport, dedupeSimilar, similarText } from './reportText';
import type { ResumeAnalysisReport } from './types';

describe('similarText', () => {
  it('treats reworded and nested points as the same', () => {
    expect(similarText('No B.Ed found on the CV', 'No B.Ed / D.El.Ed found on the CV. Most school roles require this.')).toBe(true);
    expect(similarText('Taught Physics for 6 years', 'taught physics for 6 years!')).toBe(true);
  });

  it('keeps different points apart', () => {
    expect(similarText('Has CTET Paper 2', 'Gap of 14 months between jobs')).toBe(false);
    expect(similarText('Strong Physics background', 'Strong Mathematics background')).toBe(false);
  });
});

describe('dedupeSimilar', () => {
  it('removes repeats, keeps the first wording and order, and drops blanks', () => {
    expect(dedupeSimilar(['Has B.Ed', 'has b.ed', '', 'Gap in 2021', '  '])).toEqual(['Has B.Ed', 'Gap in 2021']);
  });

  it('drops points that are already stated elsewhere', () => {
    expect(dedupeSimilar(['Name on form does not match the CV', 'Gap in 2021'], ['Name on form does not match the CV'])).toEqual(['Gap in 2021']);
  });
});

describe('cleanResumeReport', () => {
  const report = {
    eligibility_summary: 'Name on form ("Priya") does not match name on CV ("Meera").',
    form_vs_cv_discrepancies: ['Name on form ("Priya") does not match name on CV ("Meera").', 'Form lists B.Ed but the CV does not show it.'],
    red_flags: ['Name on form ("Priya") does not match name on CV ("Meera").', 'Form lists B.Ed but the CV does not show it.', 'Two jobs under a year'],
    green_flags: ['Taught Physics for 6 years', 'taught physics for 6 years'],
    pedagogical_highlights: ['Taught Physics for 6 years', 'Runs a science club'],
    recommended_interview_probes: ['Ask about the name', 'ask about the name']
  } as unknown as ResumeAnalysisReport;

  it('on a screen showing summary, mismatches and red flags, says each thing once', () => {
    const c = cleanResumeReport(report, { crossList: true });
    expect(c.form_vs_cv_discrepancies).toEqual(['Form lists B.Ed but the CV does not show it.']);
    expect(c.red_flags).toEqual(['Two jobs under a year']);
    expect(c.green_flags).toEqual(['Taught Physics for 6 years']);
    expect(c.pedagogical_highlights).toEqual(['Runs a science club']);
    expect(c.recommended_interview_probes).toEqual(['Ask about the name']);
  });

  it('without crossList keeps the red flags complete', () => {
    const c = cleanResumeReport(report);
    expect(c.red_flags).toHaveLength(3);
  });
});
