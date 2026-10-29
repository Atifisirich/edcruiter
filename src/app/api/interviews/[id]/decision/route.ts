import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { InterviewDecision, InterviewRound } from '@/lib/types';
import { checkRateLimit } from '@/lib/rateLimit';

const ROUND_LABEL: Record<InterviewRound, string> = {
  subject_lead: 'Subject Lead',
  principal: 'Principal',
  management: 'Management',
};

/**
 * Records the outcome of a scheduled interview. Reviewer identity comes
 * entirely from the authenticated session — never a request field — which
 * is the fix for the previous page's free-text "Your name" input: anyone
 * who opened it could record a decision as whoever they typed. School
 * admins may also record on a reviewer's behalf (HR sitting in, or
 * following up after the fact).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const interview = db.getScheduledInterviewById(id);
    if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 });

    const ctx = await requireSchoolAccess(interview.school_id, {
      anyOf: ['REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER', 'SCHOOL_ADMIN']
    });

    // Only the assigned reviewer, or a school admin, may record this
    // particular interview's outcome — not any other reviewer at the school.
    if (ctx.user.id !== interview.assigned_user_id && ctx.role !== 'SCHOOL_ADMIN') {
      return NextResponse.json({ error: 'Only the assigned reviewer or a school admin can record this outcome.' }, { status: 403 });
    }

    const rl = checkRateLimit(req, 'interview-decision', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many decisions recorded this hour. Try again shortly.' }, { status: 429 });
    }

    const body = await req.json();
    const { decision, reason } = body;
    if (decision !== 'accepted' && decision !== 'rejected') {
      return NextResponse.json({ error: 'decision must be "accepted" or "rejected"' }, { status: 400 });
    }
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: 'A reason is required.' }, { status: 400 });
    }

    const candidate = db.getCandidateById(ctx.schoolId, interview.candidate_id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const round = interview.round;
    const entry: InterviewDecision = {
      round,
      round_label: ROUND_LABEL[round],
      reviewer_id: ctx.user.id,
      reviewer_name: ctx.user.name,
      decision,
      reason: String(reason).trim(),
      decided_at: new Date().toISOString()
    };
    const nextLog = [...(candidate.interview_decisions || []), entry];
    const clearanceKey = round === 'subject_lead' ? 'rm_clearance' : round === 'principal' ? 'ih_clearance' : 'coo_clearance';

    const clearanceUpdate = round === 'management'
      ? {
          status: decision === 'accepted' ? 'cleared' as const : 'rejected' as const,
          decision: decision === 'accepted' ? 'offer_issued' as const : 'rejected' as const,
          notes: entry.reason,
          gmeet_link: interview.meeting_link,
          completed_at: entry.decided_at
        }
      : {
          status: decision === 'accepted' ? 'cleared' as const : 'rejected' as const,
          notes: entry.reason,
          reviewer_name: entry.reviewer_name,
          gmeet_link: interview.meeting_link,
          completed_at: entry.decided_at
        };

    const updated = db.updateCandidate(ctx.schoolId, candidate.id, {
      interview_decisions: nextLog,
      [clearanceKey]: clearanceUpdate,
      shortlist_status: decision === 'rejected' ? 'rejected' : candidate.shortlist_status,
      // A management acceptance approves the offer; the candidate is only
      // 'hired' once the offer letter is actually dispatched (OfferLetterModal).
      // Marking them hired here hid them from the reviewer page's
      // "offer not yet sent" list the moment the COO accepted.
      status: decision === 'rejected' ? 'rejected' : candidate.status
    });

    db.updateScheduledInterview(interview.id, { status: 'completed' });

    db.addAuditLog({
      id: `audit_${Date.now()}`,
      school_id: ctx.schoolId,
      actor_id: ctx.user.id,
      actor_name: ctx.user.name,
      actor_role: ctx.role,
      action: 'INTERVIEW_DECISION_RECORDED',
      resource: `Candidate: ${candidate.name} (${ROUND_LABEL[round]})`,
      details: `${decision.toUpperCase()}. ${entry.reason}`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true, candidate: updated, decision: entry });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to record decision' }, { status: 500 });
  }
}
