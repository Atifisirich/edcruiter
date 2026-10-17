import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { analyzeResumeWithAIAsync } from '@/lib/aiResumeAnalyzer';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate_id, resume_text, resume_url } = body;

    if (!candidate_id) {
      return NextResponse.json({ error: 'candidate_id is required' }, { status: 400 });
    }

    const ctx = await requireSchoolAccess(body.school_id);
    const school_id = ctx.schoolId;

    const rl = checkRateLimit(req, 'resume-reanalyze', { max: 30, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many re-analyses this hour.' }, { status: 429 });
    }

    const candidate = db.getCandidateById(school_id, candidate_id);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const school = db.getSchoolById(school_id);

    const textToAnalyze = resume_text || candidate.resume_text || `
Name: ${candidate.name}
Qualification: ${candidate.qualification}
Experience Band: ${candidate.experience_band}
Prior School / Org: ${candidate.prior_org}
Current Salary: ${candidate.current_salary}
Expected Salary: ${candidate.expected_salary}
Notice Period: ${candidate.notice_period}
Applied Subject: ${candidate.applied_subject}
Applied Segment: ${candidate.applied_segment}
Languages: ${candidate.languages?.join(', ')}
`;

    const report = await analyzeResumeWithAIAsync({
      candidateName: candidate.name,
      appliedSubject: candidate.applied_subject,
      appliedSegment: candidate.applied_segment,
      resumeText: textToAnalyze,
      curriculumGuidelines: school?.curriculum_guidelines
    });

    // Save report on candidate
    db.updateCandidate(school_id, candidate_id, {
      resume_text: textToAnalyze,
      resume_url: resume_url || candidate.resume_url,
      resume_analysis: report
    });

    auditAsStaff(ctx, school_id, {
      action: 'RESUME_ANALYZED',
      resource: `Candidate: ${candidate.name}`,
      details: `AI Resume Analyzer generated dossier (Score: ${report.overall_fitment_score}/10, Trajectory: ${report.career_trajectory.trend}, Gaps: ${report.career_gaps.length}).`
    });

    return NextResponse.json({ success: true, report });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to analyze resume' }, { status: 500 });
  }
}
