import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isScoredStage } from '@/lib/scoredStages';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  evaluateStageWithAIAsync,
  GeminiUsageSnapshot,
  NamedModelEvalError
} from '@/lib/aiScoringEngine';
import { SCREENING_BAKEOFF_MODELS } from '@/lib/modelBakeoff';
import { AIScoringContract } from '@/lib/types';

export const maxDuration = 300;

function averageScore(contract?: AIScoringContract | null): number | null {
  const dims = contract?.scores;
  if (!dims?.length) return null;
  const avg = dims.reduce((sum, d) => sum + (Number(d.score) || 0), 0) / dims.length;
  return Math.round(avg * 10) / 10;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidateId = String(body.candidate_id || '').trim();

    if (!candidateId) {
      return NextResponse.json({ error: 'candidate_id is required' }, { status: 400 });
    }

    // Internal QA tool that runs two live model calls per stage on a real
    // candidate's submission — school admin and above only, and rate-limited
    // since each call is billed API usage.
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    const rl = checkRateLimit(req, 'compare-models', { max: 10, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Model comparison limit reached for this hour.' }, { status: 429 });
    }

    const candidate = db.getCandidateById(ctx.schoolId, candidateId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    const school = db.getSchoolById(candidate.school_id);
    const hrPolicies = db.getHRPoliciesBySchool(candidate.school_id);
    const schoolRubrics = db.getRubricsBySchool(candidate.school_id);
    const questionnaires = db.getQuestionnairesBySchool(
      candidate.school_id,
      candidate.applied_subject,
      candidate.applied_segment
    );
    const priorStageResults = db.getStageResultsByCandidate(candidate.school_id, candidate.id);
    const scored = priorStageResults.filter((r) => isScoredStage(r.stage_key));

    if (!scored.length) {
      return NextResponse.json({
        error: 'This candidate has no scored stages yet. Complete written, demo, or scenario first, then run the comparison on the same submissions.'
      }, { status: 400 });
    }

    const stages = [];

    for (const result of scored) {
      const activeRubric = schoolRubrics.find(
        (r) => r.stage_key === result.stage_key || r.subject === candidate.applied_subject
      );
      const byModel: Record<string, {
        ok: boolean;
        error?: string;
        elapsed_ms: number;
        avg_score_out_of_10: number | null;
        multimodal_video_analyzed?: boolean;
        usage?: GeminiUsageSnapshot;
        contract?: AIScoringContract;
      }> = {};

      for (const model of SCREENING_BAKEOFF_MODELS) {
        let usage: GeminiUsageSnapshot | undefined;
        const started = Date.now();
        try {
          const contract = await evaluateStageWithAIAsync({
            stage: result.stage_key,
            candidateName: candidate.name,
            appliedSubject: candidate.applied_subject,
            appliedSegment: candidate.applied_segment,
            submissionText: result.written_submission || '',
            transcript: result.transcript || '',
            media_url: result.media_url,
            rubric: activeRubric,
            questionnaire: questionnaires,
            hrPolicies,
            curriculumGuidelines: school?.curriculum_guidelines,
            priorStageResults,
            modelId: model.id,
            skipModelFallback: true,
            onUsage: (u) => {
              usage = u;
            }
          });
          byModel[model.id] = {
            ok: true,
            elapsed_ms: Date.now() - started,
            avg_score_out_of_10: averageScore(contract),
            multimodal_video_analyzed: contract.multimodal_video_analyzed,
            usage,
            contract
          };
        } catch (err) {
          const message = err instanceof NamedModelEvalError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Unknown model error';
          byModel[model.id] = {
            ok: false,
            error: message,
            elapsed_ms: Date.now() - started,
            avg_score_out_of_10: null,
            usage
          };
        }
      }

      stages.push({
        stage_key: result.stage_key,
        stage_name: result.stage_name,
        has_local_video: Boolean(result.media_url && !result.media_url.startsWith('http')),
        media_url: result.media_url || '',
        by_model: byModel
      });
    }

    return NextResponse.json({
      saved_scores_unchanged: true,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        applied_subject: candidate.applied_subject,
        applied_segment: candidate.applied_segment
      },
      models: SCREENING_BAKEOFF_MODELS,
      how_to_judge: [
        'These are live Gemini API responses for gemini-3-flash-preview and gemini-3.5-flash on the exact same submissions.',
        'Watch the demo yourself first, then see which model’s quotes and gaps match what you saw.',
        'If Gemini 3 invents board-work or voice details the video does not show, keep 3.5 for video stages.',
        'If scores differ by more than ~1.5 points on 0–10 and you agree with 3.5, keep 3.5 in production.',
        'JSON parse / request errors mean that model failed for this sample — do not treat that as a local fallback score.'
      ],
      stages
    });
  } catch (error) {
    return authErrorResponse(error) ?? (() => {
      console.error('compare-models error:', error);
      return NextResponse.json({ error: 'Failed to compare models' }, { status: 500 });
    })();
  }
}
