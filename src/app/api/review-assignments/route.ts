import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { canDecideRound, currentRound, roundsFor } from '@/lib/reviewRounds';
import { notifyAllocated } from '@/lib/reviewNotify';
import type { RoundAssignment } from '@/lib/types';

const MAX_PER_REQUEST = 200;

/**
 * HR gives shortlisted teachers to a reviewer for a round: 50 teachers passed
 * the test, HR hands some to the coordinator, some to another coordinator. The
 * reviewer is told in the app. A teacher is given only for the round they are
 * waiting on, and not again once the reviewer has given their report card.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'review-assign', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many changes this hour. Try again shortly.' }, { status: 429 });

    const ids: string[] = Array.isArray(body.candidate_ids)
      ? [...new Set<string>(body.candidate_ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0))]
      : [];
    if (ids.length === 0) return NextResponse.json({ error: 'Choose at least one teacher.' }, { status: 400 });
    if (ids.length > MAX_PER_REQUEST) return NextResponse.json({ error: `Allocate at most ${MAX_PER_REQUEST} teachers at a time.` }, { status: 400 });
    const roundId = typeof body.round === 'string' ? body.round : '';
    const userId = typeof body.user_id === 'string' ? body.user_id : '';

    const school = db.getSchoolById(ctx.schoolId);
    const reviewer = db.getUsersBySchool(ctx.schoolId).find((u) => u.id === userId);
    if (!reviewer) return NextResponse.json({ error: 'That person was not found at this school.' }, { status: 400 });

    const done: string[] = [];
    const skipped: { id: string; name: string; reason: string }[] = [];
    let roundForNotice = null as ReturnType<typeof roundsFor>[number] | null;
    for (const id of ids) {
      const candidate = db.getCandidateById(ctx.schoolId, id);
      if (!candidate) { skipped.push({ id, name: id, reason: 'Not found.' }); continue; }
      const rounds = roundsFor(school, candidate);
      const round = rounds.find((r) => r.id === roundId);
      if (!round) { skipped.push({ id, name: candidate.name, reason: 'That round is not in their review flow.' }); continue; }
      if (!canDecideRound(reviewer, round) || reviewer.role === 'HR') {
        skipped.push({ id, name: candidate.name, reason: `${reviewer.name} does not review the ${round.name} round.` });
        continue;
      }
      const closed = candidate.status === 'rejected' || !!candidate.rejected_by_school_at || !!candidate.rejected_by_candidate_at;
      if (closed) { skipped.push({ id, name: candidate.name, reason: 'Not moving forward.' }); continue; }
      if (candidate.shortlist_status !== 'shortlisted' && candidate.status !== 'passed') { skipped.push({ id, name: candidate.name, reason: 'Not shortlisted yet.' }); continue; }
      if (currentRound(candidate, rounds)?.id !== round.id) { skipped.push({ id, name: candidate.name, reason: `Not waiting on the ${round.name} round.` }); continue; }
      if (candidate.round_reviews?.[round.id]) { skipped.push({ id, name: candidate.name, reason: 'Already reviewed. Pass them on or stop them.' }); continue; }

      const assignment: RoundAssignment = { user_id: reviewer.id, user_name: reviewer.name, assigned_at: new Date().toISOString(), assigned_by_name: ctx.user.name };
      db.updateCandidate(ctx.schoolId, id, { round_assignments: { ...(candidate.round_assignments ?? {}), [round.id]: assignment } });
      done.push(candidate.name);
      roundForNotice = round;
    }

    if (done.length && roundForNotice) {
      notifyAllocated({ schoolId: ctx.schoolId, reviewer, candidates: done.map((name) => ({ name })), round: roundForNotice, byName: ctx.user.name });
      auditAsStaff(ctx, ctx.schoolId, {
        action: 'REVIEW_ALLOCATED',
        resource: `${done.length} ${done.length === 1 ? 'teacher' : 'teachers'}`,
        details: `Allocated to ${reviewer.name} for the ${roundForNotice.name} round: ${done.slice(0, 10).join(', ')}${done.length > 10 ? ' and more' : ''}.`,
      });
    }
    return NextResponse.json({ success: true, allocated: done.length, skipped });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not allocate.' }, { status: 500 });
  }
}
