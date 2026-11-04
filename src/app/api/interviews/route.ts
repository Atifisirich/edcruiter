import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ScheduledInterview } from '@/lib/types';
import { HIRING_TEAM } from '@/lib/permissions';
import { canDecideRound, roundResultOf, roundsOf } from '@/lib/reviewRounds';
import { authErrorResponse, auditAsStaff, requireCandidateOrStaff, requireSchoolAccess, requireStaff, assertSchoolActive } from '@/lib/auth';
import { generateMeetingLink } from '@/lib/meetingLink';
import { sendTemplateMessage } from '@/lib/whatsappClient';
import { sendEmail } from '@/lib/emailClient';
import { escapeHtml } from '@/lib/escapeHtml';
import { createCandidateMagicLinkToken } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidate_id');
    const mine = searchParams.get('mine');

    if (candidateId) {
      const access = await requireCandidateOrStaff(candidateId);
      return NextResponse.json({ interviews: db.getScheduledInterviewsByCandidate(access.schoolId, candidateId) });
    }

    if (mine) {
      const ctx = await requireStaff();
      const schoolId = ctx.isSuperAdmin
        ? searchParams.get('school_id')
        : ctx.schoolId;
      if (!schoolId) return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
      return NextResponse.json({ interviews: db.getScheduledInterviewsForUser(schoolId, ctx.user.id) });
    }

    // Full school schedule — the HR coordination view.
    const ctx = await requireSchoolAccess(searchParams.get('school_id'));
    return NextResponse.json({ interviews: db.getScheduledInterviewsBySchool(ctx.schoolId) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load interviews' }, { status: 500 });
  }
}

/**
 * HR schedules a real interview slot: a candidate, a round, a specific staff
 * member, a time, and a link — the thing that was missing entirely before.
 * HR and the school admin allot interviews (HR decides and assigns, not any
 * reviewer for themselves), and only to someone who reviews that round.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);

    const rl = checkRateLimit(req, 'schedule-interview', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many interviews scheduled this hour. Try again shortly.' }, { status: 429 });
    }

    const { candidate_id, round, assigned_user_id, scheduled_at, duration_minutes, meeting_link, notes } = body;
    if (!candidate_id || !round || !assigned_user_id || !scheduled_at) {
      return NextResponse.json(
        { error: 'candidate_id, round, assigned_user_id and scheduled_at are required.' },
        { status: 400 }
      );
    }
    const school = db.getSchoolById(ctx.schoolId);
    const rounds = roundsOf(school);
    const roundIndex = rounds.findIndex((r) => r.id === round);
    if (roundIndex < 0) {
      return NextResponse.json({ error: 'Invalid round.' }, { status: 400 });
    }
    const theRound = rounds[roundIndex];
    const scheduledDate = new Date(scheduled_at);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'scheduled_at must be a valid date/time.' }, { status: 400 });
    }

    const candidate = db.getCandidateById(ctx.schoolId, candidate_id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found at this school.' }, { status: 404 });

    // Rounds run in the school's order. A later round may only be scheduled
    // once the one before it was cleared.
    if (candidate.status === 'rejected') {
      return NextResponse.json({ error: 'This candidate has already been declined.' }, { status: 409 });
    }
    if (candidate.shortlist_status !== 'shortlisted' && candidate.status !== 'passed') {
      return NextResponse.json({ error: 'Shortlist this teacher before scheduling an interview.' }, { status: 409 });
    }
    const previous = roundIndex > 0 ? rounds[roundIndex - 1] : null;
    if (previous && roundResultOf(candidate, previous.id)?.status !== 'cleared') {
      return NextResponse.json(
        { error: `The ${previous.name} round must be cleared before scheduling the ${theRound.name} round.` },
        { status: 409 }
      );
    }

    // The assigned person must be real staff at this school — not a free-text
    // name, which is what let anyone "be" the subject lead before — and must
    // review this round, or they could not record its outcome.
    const assignedUser = db.getUsersBySchool(ctx.schoolId).find((u) => u.id === assigned_user_id);
    if (!assignedUser) {
      return NextResponse.json({ error: 'That staff member was not found at this school.' }, { status: 400 });
    }
    if (!canDecideRound(assignedUser, theRound)) {
      return NextResponse.json({ error: `${assignedUser.name} does not review the ${theRound.name} round. Choose someone who does, or change the round in Settings.` }, { status: 400 });
    }

    const interview: ScheduledInterview = {
      id: `intv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      school_id: ctx.schoolId,
      candidate_id,
      round,
      assigned_user_id: assignedUser.id,
      assigned_user_name: assignedUser.name,
      scheduled_at: scheduledDate.toISOString(),
      duration_minutes: Number(duration_minutes) > 0 ? Number(duration_minutes) : 30,
      meeting_link: (meeting_link && String(meeting_link).trim()) || generateMeetingLink(candidate_id, round),
      status: 'scheduled',
      notes: notes ? String(notes) : undefined,
      scheduled_by_id: ctx.user.id,
      scheduled_by_name: ctx.user.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.createScheduledInterview(interview);

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'INTERVIEW_SCHEDULED',
      resource: `Candidate: ${candidate.name} (${theRound.name})`,
      details: `Assigned to ${assignedUser.name} at ${formatWhen(interview.scheduled_at)}.`
    });

    // Best-effort candidate notification — scheduling itself always
    // succeeds even if WhatsApp isn't connected or the candidate hasn't
    // consented; the interview is still visible in their portal either way.
    let whatsapp_notified = false;
    if (candidate.phone) {
      if (school?.whatsapp_hiring && school.whatsapp_hiring.status !== 'not_connected') {
        // buttonParam is a magic-login token, not the bare candidate id —
        // see the comment in /api/whatsapp/invite for why: it logs the
        // candidate in on tap and lands them on their own portal, where the
        // live meeting link and time are shown, rather than pointing at a
        // page that would just bounce them to a manual login, or embedding
        // the raw meeting URL inside the template body itself.
        const result = await sendTemplateMessage({
          school,
          candidateId: candidate.id,
          toRaw: candidate.phone,
          template: 'round_scheduled',
          bodyParams: [candidate.name, theRound.name, assignedUser.name, formatWhen(interview.scheduled_at)],
          buttonParam: createCandidateMagicLinkToken(candidate.id, candidate.school_id)
        }).catch(() => null);
        whatsapp_notified = !!result?.ok;
      }
    }

    // The assigned staff member (subject lead / principal / management)
    // used to learn about this only by opening the app and happening to
    // check — scheduling a slot here never told them anything. Best-effort
    // like the candidate notification above: a missing RESEND_API_KEY
    // never blocks scheduling, it just means nobody gets emailed.
    const staffEmailResult = await sendEmail({
      to: assignedUser.email,
      subject: `Interview scheduled: ${candidate.name} (${theRound.name})`,
      text: `Hi ${assignedUser.name},\n\nYou've been assigned to interview ${candidate.name} for the ${theRound.name} round.\n\nWhen: ${formatWhen(interview.scheduled_at)} (${interview.duration_minutes} min)\nMeeting link: ${interview.meeting_link}\n${interview.notes ? `\nNote from HR: ${interview.notes}\n` : ''}\nRecord your decision after the interview from your reviewer dashboard.\n\n— Edcruiter`,
      // Names and notes are typed by people, so they are escaped before they go into HTML.
      html: `<p>Hi ${escapeHtml(assignedUser.name)},</p><p>You've been assigned to interview <strong>${escapeHtml(candidate.name)}</strong> for the <strong>${escapeHtml(theRound.name)}</strong> round.</p><p><strong>When:</strong> ${formatWhen(interview.scheduled_at)} (${interview.duration_minutes} min)<br/><strong>Meeting link:</strong> <a href="${escapeHtml(interview.meeting_link)}">${escapeHtml(interview.meeting_link)}</a></p>${interview.notes ? `<p><strong>Note from HR:</strong> ${escapeHtml(interview.notes)}</p>` : ''}<p>Record your decision after the interview from your reviewer dashboard.</p><p>— Edcruiter</p>`,
      kind: 'interview',
      fromName: school?.name,
      replyTo: ctx.user.email,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      interview,
      whatsapp_notified,
      staff_notified: staffEmailResult?.ok === true
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to schedule interview' }, { status: 500 });
  }
}
