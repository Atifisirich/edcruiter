import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { currentRound, roundsFor } from '@/lib/reviewRounds';
import { buildReview, mayReview, rubricFor } from '@/lib/roundReview';
import { notifyReviewSubmitted } from '@/lib/reviewNotify';
import { isAdmin } from '@/lib/permissions';

/**
 * A reviewer's report card for one round: a rating on each item of the round's
 * rubric, approve or do not approve, and their opinion. It is saved and HR is
 * told. It does NOT move the teacher on, stop them, or tell the candidate
 * anything: passing a teacher on is HR's job (decision route).
 *
 * Only the reviewer HR allocated the teacher to (or booked an interview with)
 * may write it; the school admin may on their behalf. Who wrote it comes from
 * the signed-in session.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = db.getCandidateByIdPublic(id);
    if (!found) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(found.school_id);
    assertSchoolActive(ctx.schoolId);

    const rl = checkRateLimit(req, 'round-review', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many reviews this hour. Try again shortly.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const candidate = db.getCandidateById(ctx.schoolId, id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const school = db.getSchoolById(ctx.schoolId);
    const rounds = roundsFor(school, candidate);
    const round = rounds.find((r) => r.id === body.round);
    if (!round) return NextResponse.json({ error: 'Choose a review round.' }, { status: 400 });

    const interviews = db.getScheduledInterviewsByCandidate(ctx.schoolId, id);
    if (!mayReview(ctx.user, candidate, round, interviews)) {
      return NextResponse.json({ error: 'HR has not allocated this teacher to you for this round.' }, { status: 403 });
    }

    const closed = candidate.status === 'rejected' || !!candidate.rejected_by_school_at || !!candidate.rejected_by_candidate_at;
    if (closed) return NextResponse.json({ error: 'This teacher is not moving forward.' }, { status: 409 });
    if (currentRound(candidate, rounds)?.id !== round.id) return NextResponse.json({ error: `This teacher is not waiting on the ${round.name} round.` }, { status: 409 });
    if (candidate.round_reviews?.[round.id] && !isAdmin(ctx.role)) {
      return NextResponse.json({ error: 'You have already given your review for this round.' }, { status: 409 });
    }

    const built = buildReview(body, rubricFor(round), { id: ctx.user.id, name: ctx.user.name });
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: 400 });

    db.updateCandidate(ctx.schoolId, id, { round_reviews: { ...(candidate.round_reviews ?? {}), [round.id]: built.review } });
    // The interview this review is about is now done.
    for (const iv of interviews) {
      if (iv.round === round.id && iv.status === 'scheduled') db.updateScheduledInterview(iv.id, { status: 'completed' });
    }
    const told = notifyReviewSubmitted({ schoolId: ctx.schoolId, candidate, round, review: built.review });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'ROUND_REVIEW_GIVEN',
      resource: `Candidate: ${candidate.name} (${round.name})`,
      details: `${built.review.recommendation === 'approve' ? 'Approved' : 'Did not approve'}, rated ${built.review.average}/100. ${built.review.opinion}`,
    });

    return NextResponse.json({ success: true, candidate: db.getCandidateById(ctx.schoolId, id), told_hr: told });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save your review.' }, { status: 500 });
  }
}
