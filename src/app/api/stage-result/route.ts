import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { evaluateStageWithAIAsync } from '@/lib/aiScoringEngine';
import { StageResult, StageKey } from '@/lib/types';
import { SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import { isScoredStage } from '@/lib/scoredStages';
import { authErrorResponse, requireCandidate, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { findActivePack } from '@/lib/ensurePack';
import { maybeGenerateTeachingProfile } from '@/lib/profileGenerator';
import { testFor } from '@/lib/candidateTest';
import { countWords, gradeMcqs, MIN_LESSON_WORDS, type GradableMcq } from '@/lib/testRules';

/**
 * A stage submission with a scored stage triggers a live Gemini call, so this
 * is both an identity boundary (only the candidate themselves may submit
 * their own stage) and a cost boundary (rate-limited per candidate session).
 *
 * The submission is saved and answered straight away; the AI scores it in the
 * background and the result is filled in when it finishes. The candidate used
 * to sit on "Submitting…" for the whole length of the AI call (a video can take
 * a minute or more).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate_id, stage_key, transcript, media_url, video_url, candidate_updates, mcq_answers, lesson_plan } = body;
    let written_submission: string | undefined = body.written_submission;

    if (!candidate_id || !stage_key) {
      return NextResponse.json({ error: 'candidate_id and stage_key are required' }, { status: 400 });
    }

    const access = await requireCandidate(candidate_id);
    assertSchoolActive(access.schoolId);

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

    // The written stage is marked here, from the stored answer key, rather than
    // from text the browser wrote about its own answers.
    if (stage_key === 'written_theory') {
      const lessonText = typeof lesson_plan === 'string' ? lesson_plan : '';
      const words = countWords(lessonText);
      if (words < MIN_LESSON_WORDS) {
        return NextResponse.json(
          { error: `Your lesson plan has ${words} words. Please write at least ${MIN_LESSON_WORDS} words.` },
          { status: 400 }
        );
      }

      // Must be exactly the test the candidate was shown, which is the school's
      // active test for their subject and grade level and nothing else.
      const pack = findActivePack(school_id, candidate.applied_subject, candidate.applied_segment);
      // Marked against exactly the questions this candidate was given.
      const given = pack ? testFor(candidate, pack).questions : [];
      const questions: GradableMcq[] | null = given.length ? given : null;
      if (!questions) {
        return NextResponse.json(
          { error: 'Your test is still being prepared. Wait a moment and try again.' },
          { status: 409 }
        );
      }

      const graded = gradeMcqs(questions, mcq_answers && typeof mcq_answers === 'object' ? mcq_answers : {});
      if (graded.unanswered.length > 0) {
        return NextResponse.json(
          { error: `Please answer every question. ${graded.unanswered.length} still need an answer.` },
          { status: 400 }
        );
      }
      written_submission = `MCQ TEST\n\n${graded.block}\n\n--- LESSON PLAN ---\n\n${lessonText}`;
    }

    const stageConfig = SLOKA_DEFAULT_STAGES.find(s => s.key === stage_key);
    const stageName = stageConfig?.name || stage_key;
    const scored = isScoredStage(stage_key);

    const newResult: StageResult = {
      id: `sr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      school_id,
      candidate_id,
      stage_key: stage_key as StageKey,
      stage_name: stageName,
      scoring_status: scored ? 'pending' : undefined,
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
      details: `Candidate completed ${stageName}.${scored ? ' AI scoring started.' : ''}`,
      timestamp: new Date().toISOString()
    });

    if (scored) {
      const input = {
        stage: stage_key as StageKey,
        candidateName: candidate.name,
        appliedSubject: candidate.applied_subject,
        appliedSegment: candidate.applied_segment,
        submissionText: written_submission || '',
        transcript: transcript || '',
        media_url: resolvedMediaUrl
      };
      after(async () => {
        let aiScores;
        let status: StageResult['scoring_status'] = 'done';
        try {
          const school = db.getSchoolById(school_id);
          const schoolRubrics = db.getRubricsBySchool(school_id);
          aiScores = await evaluateStageWithAIAsync({
            ...input,
            rubric: schoolRubrics.find(r => r.stage_key === stage_key || r.subject === candidate.applied_subject),
            questionnaire: db.getQuestionnairesBySchool(school_id, candidate.applied_subject, candidate.applied_segment),
            hrPolicies: db.getHRPoliciesBySchool(school_id),
            curriculumGuidelines: school?.curriculum_guidelines,
            priorStageResults: db.getStageResultsByCandidate(school_id, candidate_id)
          });
        } catch (evalErr) {
          console.error('AI evaluation execution error:', evalErr);
          status = 'failed';
        }
        db.saveStageResult({ ...newResult, ai_scores: aiScores, scoring_status: status });
        db.addAuditLog({
          id: `audit_${Date.now()}_scored`,
          school_id,
          actor_id: candidate.id,
          actor_name: candidate.name,
          actor_role: 'SCHOOL_ADMIN',
          action: 'STAGE_SCORED',
          resource: `Stage: ${stageName}`,
          details: aiScores ? `AI score: ${JSON.stringify(aiScores.scores)}.` : 'AI scoring did not finish; a reviewer should score this stage.',
          timestamp: new Date().toISOString()
        });
        // Once the last scored stage is done, write the school's teaching profile.
        await maybeGenerateTeachingProfile(school_id, candidate_id);
      });
    }

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
