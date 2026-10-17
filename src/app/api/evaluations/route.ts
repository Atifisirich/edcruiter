import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { EvaluationRecord } from '@/lib/types';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidate_id');
    if (!candidateId) {
      return NextResponse.json({ error: 'candidate_id is required' }, { status: 400 });
    }

    const ctx = await requireSchoolAccess(searchParams.get('school_id'), { minRole: 'REPORTING_MANAGER' });
    const evaluations = db.getEvaluationsByCandidate(ctx.schoolId, candidateId);
    return NextResponse.json({ evaluations });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to fetch evaluations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Only the reviewer tiers record hiring decisions — RM, IH, and the final
    // decision maker. School admin retains access for support/override cases.
    const ctx = await requireSchoolAccess(body.school_id, {
      anyOf: ['REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER', 'SCHOOL_ADMIN']
    });

    const {
      candidate_id,
      decision,
      notes,
      feedback_video_url,
      recommended_branch_id,
      offered_salary,
      joining_date
    } = body;

    if (!candidate_id || !decision) {
      return NextResponse.json({ error: 'candidate_id and decision are required' }, { status: 400 });
    }

    const candidate = db.getCandidateById(ctx.schoolId, candidate_id);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // reviewer identity comes from the authenticated session, never the request body —
    // the previous version trusted a client-supplied reviewer_id/reviewer_name/
    // reviewer_role, so any caller could attribute a hiring decision to anyone.
    const evaluation: EvaluationRecord = {
      id: `eval_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      school_id: ctx.schoolId,
      candidate_id,
      reviewer_id: ctx.user.id,
      reviewer_name: ctx.user.name,
      reviewer_role: ctx.role,
      decision,
      notes: notes || '',
      feedback_video_url,
      recommended_branch_id,
      offered_salary,
      joining_date,
      timestamp: new Date().toISOString()
    };

    db.addEvaluation(evaluation);

    let newStatus: 'in_progress' | 'passed' | 'rejected' | 'hired' = candidate.status;

    if (decision === 'reject') {
      newStatus = 'rejected';
    } else if (ctx.role === 'FINAL_DECISION_MAKER' && (decision === 'hire' || decision === 'approve')) {
      newStatus = 'hired';
    } else if (decision === 'approve') {
      newStatus = 'passed';
    }

    db.updateCandidate(ctx.schoolId, candidate_id, {
      status: newStatus,
      expected_salary: offered_salary || candidate.expected_salary
    });

    db.addAuditLog({
      id: `audit_${Date.now()}`,
      school_id: ctx.schoolId,
      actor_id: ctx.user.id,
      actor_name: ctx.user.name,
      actor_role: ctx.role,
      action: 'EXECUTIVE_EVALUATION_RECORDED',
      resource: `Candidate: ${candidate.name}`,
      details: `${ctx.role} recorded "${decision.toUpperCase()}". Notes: "${notes || 'None'}". Offered: ${offered_salary || 'N/A'}.`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      evaluation,
      candidate_status: newStatus
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to record evaluation' }, { status: 500 });
  }
}
