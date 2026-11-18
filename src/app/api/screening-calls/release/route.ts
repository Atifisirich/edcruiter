import { NextRequest, NextResponse } from 'next/server';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { releaseTestLink } from '@/lib/screeningCallService';
import { db } from '@/lib/db';

/** HR (or the admin) approves a held or flagged screening result: the test link goes out now. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    if (typeof body.call_id !== 'string') return NextResponse.json({ error: 'call_id is required.' }, { status: 400 });

    const result = await releaseTestLink(body.call_id, ctx.schoolId, ctx.user.name);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const candidate = db.getCandidateById(ctx.schoolId, result.call.candidate_id);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'SCREENING_LINK_RELEASED',
      resource: `Candidate: ${candidate?.name ?? result.call.candidate_id}`,
      details: result.call.decision?.detail ?? 'Test link release attempted.',
    });
    return NextResponse.json({ call: result.call });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not send the test link.' }, { status: 500 });
  }
}
