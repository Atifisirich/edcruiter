import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evaluateStageWithAIAsync } from '@/lib/aiScoringEngine';
import { StageResult, StageKey } from '@/lib/types';
import { SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import { isScoredStage } from '@/lib/scoredStages';
import { authErrorResponse, requireCandidate } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * A stage submission with a scored stage triggers a live Gemini call, so this
 * is both an identity boundary (only the candidate themselves may submit
 * their own stage) and a cost boundary (rate-limited per candidate session).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate_id, stage_key, written_submission, transcript, media_url, video_url, candidate_updates } = body;

    if (!candidate_id || !stage_key) {
      return NextResponse.json({ error: 'candidate_id and stage_key are required' }, { status: 400 });
    }

    const access = await requireCandidate(candidate_id);

    const rl = checkRateLimit(req, 'stage-submit', { max: 20, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many submissions this hour.' }, { status: 429 });
    }

    const school_id = access.schoolId;
    const resolvedMediaUrl = (typeof media_url === 'string' && media_url.trim())
      ? media_url.trim()
      : (typeof video_url === 'string' && video_url.trim() ? video_url.trim() : '');

    // Apply any candidate updates first if provided (e.g. from Stage 1 profile submission)
    if (candidate_updates) {
      db.updateCandidate(school_id, candidate_id, candidate_updates);
    }

    const candidate = db.getCandidateById(school_id, candidate_id);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const stageConfig = SLOKA_DEFAULT_STAGES.find(s => s.key === stage_key);
    const stageName = stageConfig?.name || stage_key;

    let aiScores = undefined;
    if (isScoredStage(stage_key)) {
      const school = db.getSchoolById(school_id);
      const hrPolicies = db.getHRPoliciesBySchool(school_id);
      const schoolRubrics = db.getRubricsBySchool(school_id);
      const activeRubric = schoolRubrics.find(r => r.stage_key === stage_key || r.subject === candidate.applied_subject);
      const questionnaires = db.getQuestionnairesBySchool(school_id, candidate.applied_subject, candidate.applied_segment);
      const priorStageResults = db.getStageResultsByCandidate(school_id, candidate_id);

      try {
        aiScores = await evaluateStageWithAIAsync({
          stage: stage_key,
          candidateName: candidate.name,
          appliedSubject: candidate.applied_subject,
          appliedSegment: candidate.applied_segment,
          submissionText: written_submission || '',
          transcript: transcript || '',
          media_url: resolvedMediaUrl,
          rubric: activeRubric,
          questionnaire: questionnaires,
          hrPolicies,
          curriculumGuidelines: school?.curriculum_guidelines,
          priorStageResults
        });
      } catch (evalErr) {
        console.error('AI evaluation execution error:', evalErr);
      }
    }

    const newResult: StageResult = {
      id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      school_id,
      candidate_id,
      stage_key: stage_key as StageKey,
      stage_name: stageName,
      ai_scores: aiScores,
      written_submission,
      transcript,
      media_url: resolvedMediaUrl || undefined,
      completed_at: new Date().toISOString()
    };

    db.saveStageResult(newResult);

    const currentStageIdx = SLOKA_DEFAULT_STAGES.findIndex(s => s.key === stage_key);
    const nextStage = SLOKA_DEFAULT_STAGES[currentStageIdx + 1];
    if (nextStage) {
      db.updateCandidate(school_id, candidate_id, { current_stage_key: nextStage.key });
    }

    db.addAuditLog({
      id: `audit_${Date.now()}`,
      school_id,
      actor_id: candidate.id,
      actor_name: candidate.name,
      actor_role: 'SCHOOL_ADMIN',
      action: 'STAGE_COMPLETED',
      resource: `Stage: ${stageName}`,
      details: `Candidate completed ${stageName}. AI score: ${aiScores ? JSON.stringify(aiScores.scores) : 'N/A'}.`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      result: newResult,
      stageResult: newResult,
      candidate_updated: true
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to process stage result' }, { status: 500 });
  }
}
