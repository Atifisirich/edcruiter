import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DeletionRequest } from '@/lib/types';
import { authErrorResponse, requireStaff } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Right-to-erasure requests. This is a public, unauthenticated form — a
 * departed candidate may have no active session — so it never deletes
 * anything itself. It only records a durable, auditable request; a human at
 * the owning school (or a super admin) reviews and fulfils it via
 * /api/account/delete-request/confirm. Auto-deleting on a bare emailed
 * address would let anyone erase another candidate's application data just
 * by knowing their email, which is worse than the "logs and does nothing"
 * behaviour this replaces.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, 'deletion-request', { max: 5, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const body = await req.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    const matches = db.findCandidatesByEmail(email);
    const request: DeletionRequest = {
      id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email,
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 2000) : undefined,
      status: matches.length > 0 ? 'pending' : 'no_match',
      matched_candidates: matches.map((c) => ({ candidate_id: c.id, school_id: c.school_id })),
      requested_at: new Date().toISOString(),
      resolved_at: matches.length > 0 ? undefined : new Date().toISOString()
    };
    db.createDeletionRequest(request);

    for (const m of request.matched_candidates) {
      db.addAuditLog({
        id: `audit_del_${Date.now()}_${m.candidate_id}`,
        school_id: m.school_id,
        actor_id: 'public_deletion_request',
        actor_name: email,
        actor_role: 'SCHOOL_ADMIN',
        action: 'DELETION_REQUESTED',
        resource: `Candidate: ${m.candidate_id}`,
        details: `Right-to-erasure request received for ${email}. Awaiting staff confirmation.`,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      message: matches.length > 0
        ? 'Deletion request received. Your school will confirm and remove your data.'
        : 'Deletion request received. No matching application was found under this email.'
    });
  } catch {
    return NextResponse.json({ error: 'Unable to accept this request.' }, { status: 400 });
  }
}

/** Staff-only: list pending erasure requests. Super admin sees all; school admin sees only their own matches. */
export async function GET() {
  try {
    const ctx = await requireStaff();
    const requests = ctx.isSuperAdmin
      ? db.getPendingDeletionRequests()
      : db.getPendingDeletionRequests(ctx.schoolId ?? undefined);
    return NextResponse.json({ requests });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load deletion requests' }, { status: 500 });
  }
}
