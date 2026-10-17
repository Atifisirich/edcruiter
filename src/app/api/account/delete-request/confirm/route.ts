import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { sendEmail } from '@/lib/emailClient';

/**
 * Fulfils one matched candidate from a pending deletion request. Requires
 * staff at the owning school (or a super admin acting as that school) — the
 * public request route only ever creates a record, this is the human
 * confirmation step that actually removes the data.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { request_id, candidate_id } = body;
    if (!request_id || !candidate_id) {
      return NextResponse.json({ error: 'request_id and candidate_id are required.' }, { status: 400 });
    }

    const request = db.getDeletionRequestById(request_id);
    if (!request) {
      return NextResponse.json({ error: 'Deletion request not found.' }, { status: 404 });
    }
    const match = request.matched_candidates.find((m) => m.candidate_id === candidate_id && !m.fulfilled_at);
    if (!match) {
      return NextResponse.json({ error: 'This candidate is not a pending match on that request.' }, { status: 404 });
    }

    const ctx = await requireSchoolAccess(match.school_id, { minRole: 'SCHOOL_ADMIN' });

    const deleted = db.deleteCandidate(ctx.schoolId, candidate_id);
    if (!deleted) {
      return NextResponse.json({ error: 'Candidate record was already removed.' }, { status: 404 });
    }

    const updatedMatches = request.matched_candidates.map((m) =>
      m.candidate_id === candidate_id ? { ...m, fulfilled_at: new Date().toISOString() } : m
    );
    const allFulfilled = updatedMatches.every((m) => m.fulfilled_at);
    db.updateDeletionRequest(request_id, {
      matched_candidates: updatedMatches,
      status: allFulfilled ? 'completed' : 'pending',
      resolved_at: allFulfilled ? new Date().toISOString() : undefined
    });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'DELETION_FULFILLED',
      resource: `Candidate: ${candidate_id}`,
      details: `Fulfilled right-to-erasure request ${request_id} for ${request.email}: candidate record, stage results, proctoring events, evaluations, messages and uploaded files removed.`
    });

    // The public request form promises "we will process deletion and email a
    // confirmation" — send that confirmation once every matched candidate
    // under this request has actually been removed, not before. A send
    // failure (or no provider configured) must not undo the deletion that
    // already happened, so this is fire-and-forget from the caller's view.
    if (allFulfilled) {
      void sendEmail({
        to: request.email,
        subject: 'Your data deletion request has been completed',
        text: `Hello,\n\nYour request to delete your application data from Edcruiter has been completed. Your candidate record and all associated data (stage results, evaluations, messages, and uploaded files) have been permanently removed.\n\nIf you did not request this, please contact the school you applied to directly.\n\n— Edcruiter`,
        html: `<p>Hello,</p><p>Your request to delete your application data from Edcruiter has been completed. Your candidate record and all associated data (stage results, evaluations, messages, and uploaded files) have been permanently removed.</p><p>If you did not request this, please contact the school you applied to directly.</p><p>— Edcruiter</p>`
      });
    }

    return NextResponse.json({ success: true, request_status: allFulfilled ? 'completed' : 'pending' });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to fulfil deletion request' }, { status: 500 });
  }
}
