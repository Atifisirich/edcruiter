import { describe, expect, it } from 'vitest';
import { reconcileResumeWithClaims } from './aiResumeAnalyzer';
import { ResumeAnalysisReport } from './types';

function baseReport(overrides: Partial<ResumeAnalysisReport> = {}): ResumeAnalysisReport {
  return {
    overall_fitment_score: 9,
    career_stability_index: 'High',
    total_experience_years: 4,
    average_tenure_years: 2,
    job_hopping_risk: 'Low',
    career_gaps: [],
    career_trajectory: { trend: 'Upward', summary: 'Steady progression.', milestones: [] },
    qualifications_match: {
      degrees_found: ['M.Sc Physics'],
      alignment_with_subject: 'Strong match',
      b_ed_status: 'Not listed',
      ctet_tet_status: 'Not listed',
    },
    pedagogical_highlights: [],
    red_flags: [],
    green_flags: [],
    recommended_interview_probes: [],
    analyzed_at: new Date().toISOString(),
    eligibility_verdict: 'eligible',
    eligibility_summary: 'Strong candidate.',
    name_on_cv: 'Priya Nair',
    form_vs_cv_discrepancies: [],
    ...overrides,
  };
}

describe('reconcileResumeWithClaims — deterministic B.Ed backstop', () => {
  it('downgrades an "eligible" verdict to needs_review when the model reports no B.Ed evidence', () => {
    // This is the shape a successful prompt injection (or a confidently
    // wrong model) would produce: a high score and an "eligible" verdict
    // with nothing else in the report obviously inconsistent. The backstop
    // must catch this on the B.Ed check alone, not only when other
    // discrepancies already exist.
    const report = baseReport({ overall_fitment_score: 10, eligibility_verdict: 'eligible' });
    const result = reconcileResumeWithClaims(report, { claimedName: 'Priya Nair' });

    expect(result.eligibility_verdict).toBe('needs_review');
    expect(result.overall_fitment_score).toBeLessThanOrEqual(5);
    expect(result.form_vs_cv_discrepancies?.some((d) => d.toLowerCase().includes('b.ed'))).toBe(true);
  });

  it('leaves an "eligible" verdict alone when the model reports real B.Ed evidence', () => {
    const report = baseReport({
      eligibility_verdict: 'eligible',
      qualifications_match: {
        degrees_found: ['M.Sc Physics', 'B.Ed'],
        alignment_with_subject: 'Strong match',
        b_ed_status: 'Listed',
        ctet_tet_status: 'Listed',
      },
    });
    const result = reconcileResumeWithClaims(report, { claimedName: 'Priya Nair' });

    expect(result.eligibility_verdict).toBe('eligible');
  });

  it('does not downgrade a verdict that was already not_eligible or needs_review', () => {
    const report = baseReport({ eligibility_verdict: 'not_eligible', overall_fitment_score: 2 });
    const result = reconcileResumeWithClaims(report, { claimedName: 'Priya Nair' });

    expect(result.eligibility_verdict).toBe('not_eligible');
  });

  it('still flags a name mismatch between the form and the CV', () => {
    const report = baseReport({
      name_on_cv: 'Someone Else',
      qualifications_match: {
        degrees_found: ['M.Sc Physics', 'B.Ed'],
        alignment_with_subject: 'Strong match',
        b_ed_status: 'Listed',
        ctet_tet_status: 'Listed',
      },
    });
    const result = reconcileResumeWithClaims(report, { claimedName: 'Priya Nair' });

    expect(result.form_vs_cv_discrepancies?.some((d) => d.toLowerCase().includes('name'))).toBe(true);
    expect(result.eligibility_verdict).not.toBe('eligible');
  });
});
