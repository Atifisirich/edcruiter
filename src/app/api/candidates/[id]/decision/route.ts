import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { decide, mayTake, type DecisionAction, type DecisionInput } from '@/lib/hiringDecision';
import { notifyCandidateDeclined } from '@/lib/candidateOutcome';
import { checkRateLimit } from '@/lib/rateLimit';
import { canDecideRound, roundsFor } from '@/lib/reviewRounds';
import { reviewStillOwed } from '@/lib/roundReview';
import { matchRole } from '@/lib/payGuide';
import { notifyPassedTo } from '@/lib/reviewNotify';
import { isAdmin } from '@/lib/permissions';
import type { ReviewRound, RoundAssignment } from '@/lib/types';
import { ATTEMPT_STAGES } from '@/lib/stageAttempts';
import type { StageKey } from '@/lib/types';

const ACTIONS = new Set<DecisionAction>(['shortlist', 'hold', 'reject', 'reopen', 'round_pass', 'round_reject', 'offer_sent', 'candidate_declined']);

function refusal(action: unknown, roundName?: string): string {
  if (action === 'reopen') return 'Only the school admin can reopen a decision.';
  if (action === 'round_pass' || action === 'round_reject') {
    return roundName
      ? 'Only HR or the school admin can pass a teacher to the next round or stop them. Reviewers give their rating and opinion on the report, and HR decides.'
      : 'Choose an interview round.';
  }
  return 'Only HR or the school admin can do this.';
}

/**
 * A school's decision about a candidate after reading the report: shortlist,
 * hold, not moving forward, an interview round passed or stopped, the offer
 * sent. The rules live in hiringDecision.ts. Who decided comes from the signed-in
 * session, never from the request, and a candidate who is turned down is told
 * once, kindly, without the school's reason.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = db.getCandidateByIdPublic(id);
    if (!found) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const ctx = await requireSchoolAccess(found.school_id);
    assertSchoolActive(ctx.schoolId);

    const rl = checkRateLimit(req, 'hiring-decision', { max: 120, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many decisions this hour. Try again shortly.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const rounds = roundsFor(db.getSchoolById(ctx.schoolId), db.getCandidateById(ctx.schoolId, id));
    const round = rounds.find((r) => r.id === body.round);
    const me = { role: ctx.role, role_id: ctx.user.role_id };
    if (!mayTake(body.action, me, round)) {
      return NextResponse.json({ error: refusal(body.action, round?.name) }, { status: 403 });
    }

    // Not a decision about the candidate: the school lets them have one more go at a stage
    // after they have used the goes they are given.
    if (body.action === 'allow_retry') {
      const stage = String(body.stage_key || '') as StageKey;
      if (!(ATTEMPT_STAGES as string[]).includes(stage)) return NextResponse.json({ error: 'Choose a stage.' }, { status: 400 });
      const target = db.getCandidateById(ctx.schoolId, id);
      if (!target) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
      const extra = { ...(target.extra_attempts || {}), [stage]: (target.extra_attempts?.[stage] ?? 0) + 1 };
      const saved = db.updateCandidate(ctx.schoolId, id, { extra_attempts: extra });
      auditAsStaff(ctx, ctx.schoolId, {
        action: 'DECISION_ALLOW_RETRY',
        resource: `Candidate: ${target.name}`,
        details: `Allowed one more go at ${stage.replace(/_/g, ' ')}.`,
      });
      return NextResponse.json({ success: true, message: 'One more go allowed. The candidate gets a new set of questions.', candidate: saved });
    }

    if (!ACTIONS.has(body.action)) return NextResponse.json({ error: 'That action is not recognised.' }, { status: 400 });
    const input: DecisionInput = {
      action: body.action,
      round: round?.id,
      note: typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined,
    };

    const candidate = db.getCandidateById(ctx.schoolId, id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    // A reviewer was given this teacher: HR waits for their report card before passing or stopping.
    if ((input.action === 'round_pass' || input.action === 'round_reject') && round && reviewStillOwed(candidate, round.id) && !isAdmin(ctx.role)) {
      return NextResponse.json({ error: `Wait for ${candidate.round_assignments?.[round.id]?.user_name ?? 'the reviewer'} to give their review of the ${round.name} round first.` }, { status: 409 });
    }

    // At the final round, when the Pay Guide covers this teacher, the offer must be set and approved first.
    if (input.action === 'round_pass' && round && rounds[rounds.length - 1]?.id === round.id) {
      const payRole = matchRole(db.getSchoolById(ctx.schoolId)?.pay_guide, candidate);
      if (payRole) {
        const o = candidate.final_offer;
        const wait = !o ? 'The decision-maker has not set the salary offer yet.'
          : o.status === 'pending_approval' ? 'The offer is waiting for the school admin to approve it, because it is outside the Pay Guide.'
          : o.status === 'refused' ? 'The school admin did not approve that offer. The decision-maker needs to make a new one.'
          : '';
        if (wait) return NextResponse.json({ error: `${wait} Then you can select this teacher.` }, { status: 409 });
      }
    }

    const outcome = decide(candidate, input, { id: ctx.user.id, name: ctx.user.name }, undefined, rounds);
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: 400 });

    const updated = db.updateCandidate(ctx.schoolId, id, outcome.updates);
    if (!updated) return NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });

    auditAsStaff(ctx, ctx.schoolId, {
      action: `DECISION_${input.action.toUpperCase()}`,
      resource: `Candidate: ${candidate.name}`,
      details: `${outcome.message}${input.note ? ` Note: ${input.note.trim()}` : ''}`,
    });

    // A yes moves the teacher on: whoever runs the next round (and HR) is told to book it.
    let nextUp: ReviewRound | null | undefined;
    let toldNext: string[] = [];
    const passedRound = rounds.find((r) => r.id === round?.id);
    if ((input.action === 'round_pass' || input.action === 'round_reject') && passedRound) {
      // The round is decided, so its booked slot is no longer open.
      for (const iv of db.getScheduledInterviewsByCandidate(ctx.schoolId, id)) {
        if (iv.round === passedRound.id && iv.status === 'scheduled') db.updateScheduledInterview(iv.id, { status: 'completed' });
      }
    }
    if (input.action === 'round_pass' && passedRound) {
      const at = rounds.findIndex((r) => r.id === passedRound.id);
      nextUp = rounds[at + 1] ?? null;
      // HR passes the teacher on and, in the same step, can hand them to the next round's reviewer.
      if (nextUp && typeof body.next_user_id === 'string' && body.next_user_id) {
        const next = db.getUsersBySchool(ctx.schoolId).find((u) => u.id === body.next_user_id);
        if (next && next.role !== 'HR' && canDecideRound(next, nextUp)) {
          const assignment: RoundAssignment = { user_id: next.id, user_name: next.name, assigned_at: new Date().toISOString(), assigned_by_name: ctx.user.name };
          const fresh = db.getCandidateById(ctx.schoolId, id);
          db.updateCandidate(ctx.schoolId, id, { round_assignments: { ...(fresh?.round_assignments ?? {}), [nextUp.id]: assignment } });
          notifyPassedTo({ schoolId: ctx.schoolId, reviewer: next, candidate, round: nextUp, byName: ctx.user.name });
          toldNext = [next.name];
        }
      }
    }

    const candidateNotified = outcome.declinesCandidate && body.notify_candidate !== false
      ? await notifyCandidateDeclined(ctx.schoolId, id).catch(() => undefined)
      : undefined;

    return NextResponse.json({
      success: true,
      message: outcome.message,
      candidate: db.getCandidateById(ctx.schoolId, id) || updated,
      candidate_notified: candidateNotified,
      ...(nextUp !== undefined ? { next_round: nextUp, next_round_told: toldNext } : {}),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });
  }
}
