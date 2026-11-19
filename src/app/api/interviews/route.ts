import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ScheduledInterview } from '@/lib/types';
import { HIRING_TEAM } from '@/lib/permissions';
import { canDecideRound, roundResultOf, roundsOf } from '@/lib/reviewRounds';
import { authErrorResponse, auditAsStaff, requireCandidateOrStaff, requireSchoolAccess, requireStaff, assertSchoolActive } from '@/lib/auth';
import { generateMeetingLink } from '@/lib/meetingLink';
import { createMeetEvent } from '@/lib/googleCalendar';
import { formatWhen, notifyInterviewScheduled } from '@/lib/interviewNotify';
import { checkRateLimit } from '@/lib/rateLimit';

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

    const when = scheduledDate.toISOString();
    const duration = Number(duration_minutes) > 0 ? Math.min(240, Number(duration_minutes)) : 30;
    const pasted = typeof meeting_link === 'string' ? meeting_link.trim() : '';
    if (pasted && !/^https:\/\/\S+$/i.test(pasted)) {
      return NextResponse.json({ error: 'The meeting link must start with https://' }, { status: 400 });
    }

    // A real Google Meet when the school connected Google and HR did not paste
    // their own link. If Google fails, a Jitsi room, so the booking still goes through.
    let meetingLink = pasted;
    let provider: ScheduledInterview['meeting_provider'] = pasted ? 'pasted' : 'jitsi';
    let calendarEventId: string | undefined;
    let meetWarning: string | undefined;
    if (!pasted && school?.google_calendar && body.use_google_meet !== false) {
      try {
        const made = await createMeetEvent(school.google_calendar, {
          summary: `${theRound.name} interview: ${candidate.name} (${candidate.applied_subject}) - ${school.name}`,
          description: [
            `${theRound.name} interview for the ${candidate.applied_subject} post at ${school.name}.`,
            `Candidate: ${candidate.name}`,
            `Interviewer: ${assignedUser.name}`,
            notes ? `Note: ${String(notes)}` : '',
            'Booked with Edcruiter.',
          ].filter(Boolean).join('\n'),
          startIso: when,
          durationMin: duration,
          attendees: [
            { email: candidate.email, name: candidate.name },
            { email: assignedUser.email, name: assignedUser.name },
          ],
        });
        meetingLink = made.meetLink;
        calendarEventId = made.eventId;
        provider = 'google_meet';
      } catch (err) {
        meetWarning = `Google Meet could not be made (${err instanceof Error ? err.message : 'unknown error'}), so a free Jitsi room was used instead.`;
      }
    }
    if (!meetingLink) meetingLink = generateMeetingLink(candidate_id, round);

    const interview: ScheduledInterview = {
      id: `intv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      school_id: ctx.schoolId,
      candidate_id,
      round,
      assigned_user_id: assignedUser.id,
      assigned_user_name: assignedUser.name,
      scheduled_at: when,
      duration_minutes: duration,
      meeting_link: meetingLink,
      meeting_provider: provider,
      ...(calendarEventId ? { calendar_event_id: calendarEventId } : {}),
      status: 'scheduled',
      notes: notes ? String(notes).slice(0, 1000) : undefined,
      scheduled_by_id: ctx.user.id,
      scheduled_by_name: ctx.user.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.createScheduledInterview(interview);

    // The candidate on WhatsApp and email, the interviewer, the rest of the round's reviewers, and HR.
    const notified = school
      ? await notifyInterviewScheduled({ school, candidate, interview, round: theRound, scheduledBy: ctx.user }).catch(() => ({ candidate_whatsapp: false, candidate_email: false, staff: [] }))
      : { candidate_whatsapp: false, candidate_email: false, staff: [] };
    db.updateScheduledInterview(interview.id, { notified });
    interview.notified = notified;

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'INTERVIEW_SCHEDULED',
      resource: `Candidate: ${candidate.name} (${theRound.name})`,
      details: `Assigned to ${assignedUser.name} at ${formatWhen(interview.scheduled_at)} on ${provider === 'google_meet' ? 'Google Meet' : provider === 'pasted' ? 'a pasted link' : 'Jitsi'}. Told: ${[notified.candidate_whatsapp && 'candidate on WhatsApp', notified.candidate_email && 'candidate by email', ...notified.staff].filter(Boolean).join(', ') || 'nobody (no email or WhatsApp set up)'}.`
    });

    return NextResponse.json({
      success: true,
      interview,
      notified,
      ...(meetWarning ? { warning: meetWarning } : {}),
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to schedule interview' }, { status: 500 });
  }
}
