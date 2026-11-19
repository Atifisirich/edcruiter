import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { notifyCandidateDeclined } from '@/lib/candidateOutcome';
import { decide } from '@/lib/hiringDecision';
import { isAdmin } from '@/lib/permissions';
import { roundsOf } from '@/lib/reviewRounds';
import { notifyRoundCleared } from '@/lib/interviewNotify';

/**
 * Records the outcome of a scheduled interview: the reviewer's yes or no and
 * their opinion. Reviewer identity comes entirely from the authenticated
 * session — never a request field — which is the fix for the previous page's
 * free-text "Your name" input: anyone who opened it could record a decision as
 * whoever they typed. The school admin may also record on a reviewer's behalf.
 * The round rules are the same as a decision from the report (hiringDecision.ts).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const interview = db.getScheduledInterviewById(id);
    if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 });

    const ctx = await requireSchoolAccess(interview.school_id);

    // Only the assigned reviewer, or the school admin, may record this
    // particular interview's outcome — not any other reviewer at the school.
    if (ctx.user.id !== interview.assigned_user_id && !isAdmin(ctx.role)) {
      return NextResponse.json({ error: 'Only the assigned reviewer or the school admin can record this outcome.' }, { status: 403 });
    }
    if (interview.status !== 'scheduled') {
      return NextResponse.json({ error: 'This interview is no longer open.' }, { status: 409 });
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

    const candidate = db.getCandidateById(ctx.schoolId, interview.candidate_id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const rounds = roundsOf(db.getSchoolById(ctx.schoolId));
    const round = rounds.find((r) => r.id === interview.round);
    if (!round) return NextResponse.json({ error: 'This round is no longer one of your school’s review rounds.' }, { status: 409 });

    const outcome = decide(
      candidate,
      {
        action: decision === 'accepted' ? 'round_pass' : 'round_reject',
        round: round.id,
        note: typeof reason === 'string' ? reason.slice(0, 1000) : '',
        meetingLink: interview.meeting_link,
      },
      { id: ctx.user.id, name: ctx.user.name },
      undefined,
      rounds
    );
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: 400 });

    const updated = db.updateCandidate(ctx.schoolId, candidate.id, outcome.updates);
    db.updateScheduledInterview(interview.id, { status: 'completed' });

    // Tell a declined candidate the outcome (once, kindly, no internal reason).
    const candidateNotified = outcome.declinesCandidate && body.notify_candidate !== false
      ? await notifyCandidateDeclined(ctx.schoolId, candidate.id)
      : undefined;

    // A yes moves the teacher on: whoever runs the next round (and HR) is told to book it.
    let nextUp: { id: string; name: string } | null | undefined;
    let toldNext: string[] = [];
    const passedRound = rounds.find((r) => r.id === round?.id);
    if (passedRound && decision === 'accepted') {
      const at = rounds.findIndex((r) => r.id === passedRound.id);
      nextUp = rounds[at + 1] ?? null;
      const school = db.getSchoolById(ctx.schoolId);
      if (school) {
        toldNext = await notifyRoundCleared({ school, candidate: candidate, round: passedRound, next: rounds[at + 1] ?? null, decidedBy: ctx.user, note: String(reason).trim() }).catch(() => []);
      }
    }

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'INTERVIEW_DECISION_RECORDED',
      resource: `Candidate: ${candidate.name} (${round.name})`,
      details: `${decision === 'accepted' ? 'Yes' : 'No'}. ${String(reason).trim()}`,
    });

    return NextResponse.json({
      success: true,
      message: outcome.message,
      candidate: db.getCandidateById(ctx.schoolId, candidate.id) || updated,
      candidate_notified: candidateNotified,
      ...(nextUp !== undefined ? { next_round: nextUp, next_round_told: toldNext } : {}),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to record decision' }, { status: 500 });
  }
}
