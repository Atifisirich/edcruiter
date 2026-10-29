import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ScheduledInterview, InterviewRound } from '@/lib/types';
import { authErrorResponse, auditAsStaff, requireCandidateOrStaff, requireSchoolAccess, requireStaff } from '@/lib/auth';
import { generateMeetingLink } from '@/lib/meetingLink';
import { sendTemplateMessage } from '@/lib/whatsappClient';
import { sendEmail } from '@/lib/emailClient';
import { createCandidateMagicLinkToken } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';

const ROUND_LABEL: Record<InterviewRound, string> = {
  subject_lead: 'Subject Lead',
  principal: 'Principal',
  management: 'Management',
};

const PREVIOUS_ROUND: Partial<Record<InterviewRound, InterviewRound>> = {
  principal: 'subject_lead',
  management: 'principal',
};

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
 * Only school admins allot interviews, matching how the school actually
 * wants this to work (HR decides and assigns, not any reviewer for themselves).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

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
    if (!(round in ROUND_LABEL)) {
      return NextResponse.json({ error: 'Invalid round.' }, { status: 400 });
    }
    const scheduledDate = new Date(scheduled_at);
    if (Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: 'scheduled_at must be a valid date/time.' }, { status: 400 });
    }

    const candidate = db.getCandidateById(ctx.schoolId, candidate_id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found at this school.' }, { status: 404 });

    // Rounds run in order: subject lead, then principal, then management. A
    // later round may only be scheduled once the one before it was accepted.
    if (candidate.status === 'rejected') {
      return NextResponse.json({ error: 'This candidate has already been declined.' }, { status: 409 });
    }
    const previous = PREVIOUS_ROUND[round as InterviewRound];
    if (previous) {
      const last = [...(candidate.interview_decisions || [])].reverse().find((d) => d.round === previous);
      if (last?.decision !== 'accepted') {
        return NextResponse.json(
          { error: `The ${ROUND_LABEL[previous]} round must be accepted before scheduling the ${ROUND_LABEL[round as InterviewRound]} round.` },
          { status: 409 }
        );
      }
    }

    // The assigned person must be real staff at this school — not a free-text
    // name, which is what let anyone "be" the subject lead before.
    const assignedUser = db.getUsersBySchool(ctx.schoolId).find((u) => u.id === assigned_user_id);
    if (!assignedUser) {
      return NextResponse.json({ error: 'That staff member was not found at this school.' }, { status: 400 });
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
      resource: `Candidate: ${candidate.name} (${ROUND_LABEL[round as InterviewRound]})`,
      details: `Assigned to ${assignedUser.name} at ${formatWhen(interview.scheduled_at)}.`
    });

    // Best-effort candidate notification — scheduling itself always
    // succeeds even if WhatsApp isn't connected or the candidate hasn't
    // consented; the interview is still visible in their portal either way.
    let whatsapp_notified = false;
    if (candidate.phone) {
      const school = db.getSchoolById(ctx.schoolId);
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
          bodyParams: [candidate.name, ROUND_LABEL[round as InterviewRound], assignedUser.name, formatWhen(interview.scheduled_at)],
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
      subject: `Interview scheduled: ${candidate.name} (${ROUND_LABEL[round as InterviewRound]})`,
      text: `Hi ${assignedUser.name},\n\nYou've been assigned to interview ${candidate.name} for the ${ROUND_LABEL[round as InterviewRound]} round.\n\nWhen: ${formatWhen(interview.scheduled_at)} (${interview.duration_minutes} min)\nMeeting link: ${interview.meeting_link}\n${interview.notes ? `\nNote from HR: ${interview.notes}\n` : ''}\nRecord your decision after the interview from your reviewer dashboard.\n\n— Edcruiter`,
      html: `<p>Hi ${assignedUser.name},</p><p>You've been assigned to interview <strong>${candidate.name}</strong> for the <strong>${ROUND_LABEL[round as InterviewRound]}</strong> round.</p><p><strong>When:</strong> ${formatWhen(interview.scheduled_at)} (${interview.duration_minutes} min)<br/><strong>Meeting link:</strong> <a href="${interview.meeting_link}">${interview.meeting_link}</a></p>${interview.notes ? `<p><strong>Note from HR:</strong> ${interview.notes}</p>` : ''}<p>Record your decision after the interview from your reviewer dashboard.</p><p>— Edcruiter</p>`
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
