import { NextRequest, NextResponse } from 'next/server';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { approveDecline, dismissResult, releaseTestLink } from '@/lib/screeningCallService';
import { db } from '@/lib/db';

/**
 * HR (or the admin) acts on a screening result that is waiting for them.
 *   { school_id, call_id }                     send the test link now
 *   { school_id, call_id, action: 'decline' }  approve the suggested decline: the candidate is told, kindly, once
 *   { school_id, call_id, action: 'dismiss' }  leave it; nothing is sent
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    if (typeof body.call_id !== 'string') return NextResponse.json({ error: 'call_id is required.' }, { status: 400 });
    const action = body.action === 'decline' ? 'decline' : body.action === 'dismiss' ? 'dismiss' : 'send_link';

    const result = action === 'decline'
      ? await approveDecline(body.call_id, ctx.schoolId, { id: ctx.user.id, name: ctx.user.name })
      : action === 'dismiss'
        ? dismissResult(body.call_id, ctx.schoolId, ctx.user.name)
        : await releaseTestLink(body.call_id, ctx.schoolId, ctx.user.name);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const candidate = db.getCandidateById(ctx.schoolId, result.call.candidate_id);
    auditAsStaff(ctx, ctx.schoolId, {
      action: action === 'decline' ? 'SCREENING_DECLINE_APPROVED' : action === 'dismiss' ? 'SCREENING_RESULT_DISMISSED' : 'SCREENING_LINK_RELEASED',
      resource: `Candidate: ${candidate?.name ?? result.call.candidate_id}`,
      details: result.call.decision?.detail ?? 'Done.',
    });
    return NextResponse.json({ call: result.call });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not do that.' }, { status: 500 });
  }
}
