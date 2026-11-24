import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateStageWithAI, isMisappliedHrPolicyScore } from '@/lib/aiScoringEngine';
import { isScoredStage } from '@/lib/scoredStages';
import { Candidate, StageResult } from '@/lib/types';
import { CANDIDATE_SELF_FIELDS, candidateSelfView, candidateView, pickAllowed } from '@/lib/candidateFields';
import { ageFromDob } from '@/lib/age';
import { assertSchoolActive, authErrorResponse, requireCandidateOrStaff } from '@/lib/auth';
import { notifyCandidateDeclined } from '@/lib/candidateOutcome';
import { isAdmin } from '@/lib/permissions';

function repairStageResults(schoolId: string, candidateId: string, results: StageResult[]): StageResult[] {
  const candidate = db.getCandidateById(schoolId, candidateId);
  if (!candidate) return results;

  return results.map((result) => {
    // A submission the AI is still scoring is not broken. Only one that has
    // been pending for ten minutes is treated as lost and falls through to the
    // quick built-in marking below, flagged as failed.
    if (result.scoring_status === 'pending') {
      const waitedMs = Date.now() - Date.parse(result.completed_at);
      if (waitedMs < 10 * 60_000) return result;
    }

    const needsRescore =
      isMisappliedHrPolicyScore(result.stage_key, result.ai_scores) ||
      (isScoredStage(result.stage_key) && !result.ai_scores?.scores?.length);

    if (!needsRescore) return result;

    const ai_scores = evaluateStageWithAI({
      stage: result.stage_key,
      candidateName: candidate.name,
      appliedSubject: candidate.applied_subject,
      appliedSegment: candidate.applied_segment,
      submissionText: result.written_submission || '',
      transcript: result.transcript || '',
      media_url: result.media_url
    });

    const repaired: StageResult = { ...result, ai_scores, scoring_status: result.scoring_status === 'pending' ? 'failed' : result.scoring_status };
    db.saveStageResult(repaired);
    return repaired;
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireCandidateOrStaff(id);

    let candidate = db.getCandidateById(access.schoolId, id);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    let stageResults = db.getStageResultsByCandidate(candidate.school_id, candidate.id);
    stageResults = repairStageResults(candidate.school_id, candidate.id, stageResults);
    candidate = db.getCandidateById(candidate.school_id, candidate.id) || candidate;

    const proctoringEvents = db.getProctoringEventsByCandidate(candidate.school_id, candidate.id);
    const evaluations = db.getEvaluationsByCandidate(candidate.school_id, candidate.id);
    const school = db.getSchoolById(candidate.school_id);
    const schoolName = school?.name;
    // The subjects and grade levels this school hires for, so the candidate
    // picks from the school's own list rather than a fixed set of six.
    const schoolSubjects = school?.subjects || [];
    const schoolSegments = school?.segments || [];

    // The questions of a school's own test carry their answer key, so they stay on the server.
    const stageAttempts = db.getStageAttempts(candidate.school_id, candidate.id).map(({ own_questions: _own, ...rest }) => rest);
    return NextResponse.json({ candidate: access.kind === 'candidate' ? candidateSelfView(candidate) : candidateView(candidate), stageResults, proctoringEvents, evaluations, stageAttempts, schoolName, schoolSubjects, schoolSegments });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to fetch candidate profile' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireCandidateOrStaff(id);
    assertSchoolActive(access.schoolId);
    const body = await req.json();
    const requestedUpdates = (body.updates || body) as Record<string, unknown>;

    // A candidate may only ever touch their own stage-1 profile fields. Among
    // staff, only the school admin may change a candidate's data directly;
    // HR and reviewers act through decisions (/api/candidates/[id]/decision),
    // which are checked and recorded.
    if (access.kind === 'staff' && !isAdmin(access.ctx.role)) {
      return NextResponse.json({ error: 'Only the school admin can change a candidate’s details.' }, { status: 403 });
    }
    const updates = access.kind === 'candidate'
      ? pickAllowed(requestedUpdates, CANDIDATE_SELF_FIELDS)
      : requestedUpdates;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No permitted fields in update.' }, { status: 400 });
    }

    // Age follows the date of birth, never a typed number.
    if (typeof updates.dob === 'string') {
      (updates as Record<string, unknown>).age = ageFromDob(updates.dob) ?? undefined;
    }

    const before = db.getCandidateById(access.schoolId, id);
    const updated = db.updateCandidate(access.schoolId, id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update candidate' }, { status: 404 });
    }

    // Staff just declined this candidate: let them know instead of leaving
    // them waiting. Staff can opt out per request with notify_candidate: false.
    let candidateNotified;
    const newlyDeclined = access.kind !== 'candidate' && !!updates.rejected_by_school_at && !before?.rejected_by_school_at;
    if (newlyDeclined && body.notify_candidate !== false) {
      candidateNotified = await notifyCandidateDeclined(access.schoolId, id);
    }

    const enriched = db.getCandidateById(access.schoolId, id) || updated;
    return NextResponse.json({ success: true, candidate: candidateView(enriched), candidate_notified: candidateNotified });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update candidate profile' }, { status: 500 });
  }
}
