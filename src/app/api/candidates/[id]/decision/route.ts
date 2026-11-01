import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { decide, type DecisionAction, type DecisionInput } from '@/lib/hiringDecision';
import { notifyCandidateDeclined } from '@/lib/candidateOutcome';
import { checkRateLimit } from '@/lib/rateLimit';
import { ATTEMPT_STAGES } from '@/lib/stageAttempts';
import type { InterviewRound, StageKey } from '@/lib/types';

const ACTIONS = new Set<DecisionAction>(['shortlist', 'hold', 'reject', 'reopen', 'round_pass', 'round_reject', 'offer_sent', 'candidate_declined']);
const ROUND_IDS = new Set<InterviewRound>(['subject_lead', 'principal', 'management']);

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

    const ctx = await requireSchoolAccess(found.school_id, {
      anyOf: ['REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER', 'SCHOOL_ADMIN'],
    });
    assertSchoolActive(ctx.schoolId);

    const rl = checkRateLimit(req, 'hiring-decision', { max: 120, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many decisions this hour. Try again shortly.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));

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
      round: ROUND_IDS.has(body.round) ? body.round : undefined,
      note: typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined,
    };

    const candidate = db.getCandidateById(ctx.schoolId, id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const outcome = decide(candidate, input, { id: ctx.user.id, name: ctx.user.name });
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: 400 });

    const updated = db.updateCandidate(ctx.schoolId, id, outcome.updates);
    if (!updated) return NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });

    auditAsStaff(ctx, ctx.schoolId, {
      action: `DECISION_${input.action.toUpperCase()}`,
      resource: `Candidate: ${candidate.name}`,
      details: `${outcome.message}${input.note ? ` Note: ${input.note.trim()}` : ''}`,
    });

    const candidateNotified = outcome.declinesCandidate && body.notify_candidate !== false
      ? await notifyCandidateDeclined(ctx.schoolId, id).catch(() => undefined)
      : undefined;

    return NextResponse.json({
      success: true,
      message: outcome.message,
      candidate: db.getCandidateById(ctx.schoolId, id) || updated,
      candidate_notified: candidateNotified,
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the decision.' }, { status: 500 });
  }
}
