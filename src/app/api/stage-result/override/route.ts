import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, requireSchoolAccess } from '@/lib/auth';

/**
 * Records a human override of an AI score. The reviewer identity comes from
 * the authenticated session, never the request body — the previous version
 * trusted client-supplied reviewer_id/reviewer_name and defaulted to a
 * hardcoded 'user_rm_math' when absent, which made the audit trail this
 * endpoint exists to produce attributable to nobody in particular.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidate_id, stage_key, original_ai_score, overridden_score, justification_note } = body;

    if (!body.school_id || !candidate_id || !stage_key || overridden_score === undefined || overridden_score === null || !justification_note) {
      return NextResponse.json({ error: 'Missing required parameters or justification note' }, { status: 400 });
    }

    const ctx = await requireSchoolAccess(body.school_id, {
      anyOf: ['REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER', 'SCHOOL_ADMIN']
    });
    assertSchoolActive(ctx.schoolId);

    const results =db.getStageResultsByCandidate(ctx.schoolId, candidate_id);
    const targetResult = results.find(r => r.stage_key === stage_key);

    if (!targetResult) {
      return NextResponse.json({ error: 'Stage result not found' }, { status: 404 });
    }

    targetResult.human_override = {
      original_ai_score,
      overridden_score: Number(overridden_score),
      justification_note,
      reviewer_id: ctx.user.id,
      reviewer_name: ctx.user.name,
      timestamp: new Date().toISOString()
    };

    db.saveStageResult(targetResult);

    db.addAuditLog({
      id: `audit_${Date.now()}`,
      school_id: ctx.schoolId,
      actor_id: ctx.user.id,
      actor_name: ctx.user.name,
      actor_role: ctx.role,
      action: 'AI_SCORE_OVERRIDE',
      resource: `Candidate: ${candidate_id} (${stage_key})`,
      details: `Overrode AI score from ${original_ai_score} to ${overridden_score}. Note: "${justification_note}".`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ result: targetResult });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to record human score override' }, { status: 500 });
  }
}
