import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { evaluateStageWithAIAsync } from '@/lib/aiScoringEngine';
import { StageResult, StageKey, PolicyAnswer } from '@/lib/types';
import { asksPolicyQuestions, parsePolicyAnswers, policyAnswersText, policyQuestionsOf } from '@/lib/policyVideo';
import { SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import { isScoredStage } from '@/lib/scoredStages';
import { authErrorResponse, requireCandidate, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { findActivePack } from '@/lib/ensurePack';
import { maybeGenerateTeachingProfile } from '@/lib/profileGenerator';
import { testFor } from '@/lib/candidateTest';
import { resolveTest } from '@/lib/testBank';
import { closeAttempt, openAttempt } from '@/lib/attemptService';
import { canStart } from '@/lib/stageAttempts';
import { CANDIDATE_SELF_FIELDS, pickAllowed } from '@/lib/candidateFields';
import { ageFromDob } from '@/lib/age';
import { countWords, gradeMcqs, MIN_LESSON_WORDS, type GradableMcq } from '@/lib/testRules';
import { buildBehaviour, type AnswerBehaviour } from '@/lib/answerBehaviour';
import { createProctoringEvent } from '@/lib/proctoringEngine';

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
    let behaviour: AnswerBehaviour | undefined;

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

    const existing = db.getCandidateById(school_id, candidate_id);
    if (!existing) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Stages are taken one at a time, in order, each as its own go. The details
    // stage can be saved again; every other stage is final once handed in.
    const doneKeys = db.getStageResultsByCandidate(school_id, candidate_id).map((r) => r.stage_key);
    const attempt = stage_key === 'identity_verification' ? undefined : openAttempt(school_id, candidate_id, stage_key as StageKey);
    if (stage_key !== 'identity_verification') {
      if (doneKeys.includes(stage_key)) {
        return NextResponse.json({ error: 'This stage is already finished.' }, { status: 409 });
      }
      if (!canStart(stage_key as StageKey, doneKeys)) {
        return NextResponse.json({ error: 'Please finish the earlier stages first.' }, { status: 409 });
      }
      if (!attempt) {
        return NextResponse.json({ error: 'This stage was not opened, or was closed because it was left for a while. Open it again from your list of stages.', code: 'no_open_attempt' }, { status: 409 });
      }
    }

    if (resolvedMediaUrl) {
      const owner = db.findCandidateByMediaUrl(resolvedMediaUrl);
      if (owner && owner.candidateId !== candidate_id) {
        return NextResponse.json({ error: 'That recording does not belong to this application.' }, { status: 403 });
      }
    }

    // Apply any candidate updates first if provided (the stage 1 details). Only the
    // fields a candidate may set about themselves go through; their age follows
    // their date of birth. The CV link is accepted only if it points at an uploaded file.
    if (candidate_updates && typeof candidate_updates === 'object') {
      const safe: Record<string, unknown> = { ...pickAllowed(candidate_updates, CANDIDATE_SELF_FIELDS) };
      if (typeof safe.dob === 'string') safe.age = ageFromDob(safe.dob) ?? undefined;
      if (typeof candidate_updates.resume_url === 'string' && candidate_updates.resume_url.startsWith('/api/media/')) {
        const owner = db.findCandidateByMediaUrl(candidate_updates.resume_url);
        if (!owner || owner.candidateId === candidate_id) safe.resume_url = candidate_updates.resume_url;
      }
      db.updateCandidate(school_id, candidate_id, safe);
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

      // Must be exactly the test the candidate was shown in this go.
      const pack = findActivePack(school_id, candidate.applied_subject, candidate.applied_segment);
      // Marked against exactly the questions this candidate was given.
      const given = attempt?.test_ids?.length
        ? resolveTest(attempt.test_ids, candidate.id)
        : pack ? testFor(candidate, pack).questions : [];
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
      behaviour = buildBehaviour(body.behaviour?.typing, body.behaviour?.mcq, lessonText);
    }

    // Stage 5: the school's policy video and questions. The questions and their
    // wording come from the school as they are now, never from the browser.
    let policyAnswers: PolicyAnswer[] | undefined;
    let policyVideo: StageResult['policy_video'];
    if (stage_key === 'hr_policy_briefing') {
      const school = db.getSchoolById(school_id);
      if (asksPolicyQuestions(school)) {
        if (school?.policy_video && body.policy_video_watched !== true) {
          return NextResponse.json({ error: 'Please watch the school’s policy video to the end first.' }, { status: 400 });
        }
        const parsed = parsePolicyAnswers(policyQuestionsOf(school), body.policy_answers);
        if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
        policyAnswers = parsed.answers;
        if (school?.policy_video) policyVideo = { id: school.policy_video.id, title: school.policy_video.title, watched_to_end: true };
        written_submission = [policyAnswersText(policyAnswers, policyVideo), written_submission].filter(Boolean).join('\n\n');
      }
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
      task_prompt: attempt?.prompt,
      attempt_number: attempt?.number,
      behaviour,
      policy_answers: policyAnswers,
      policy_video: policyVideo,
      completed_at: new Date().toISOString()
    };

    db.saveStageResult(newResult);
    if (attempt) closeAttempt(attempt);

    // Two or more signals are worth a line in the proctoring record. They are signals, not proof.
    if (behaviour && behaviour.signals.length >= 2) {
      db.addProctoringEvent(createProctoringEvent(school_id, candidate_id, 'written_theory', 'TYPING_ANOMALY', `Answer pattern: ${behaviour.signals.slice(0, 2).join(' ')}`));
    }

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
