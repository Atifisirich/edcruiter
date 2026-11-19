import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { ScheduledInterview } from '@/lib/types';
import { checkRateLimit } from '@/lib/rateLimit';
import { cancelMeetEvent, moveMeetEvent } from '@/lib/googleCalendar';

/** Reschedule or cancel — HR's calendar to change, per "HR decides and allots". */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = db.getScheduledInterviewById(id);
    if (!existing) return NextResponse.json({ error: 'Interview not found' }, { status: 404 });

    const ctx = await requireSchoolAccess(existing.school_id, { anyOf: HIRING_TEAM });

    const rl = checkRateLimit(req, 'update-interview', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many changes this hour. Try again shortly.' }, { status: 429 });
    }

    const body = await req.json();

    const updates: Partial<ScheduledInterview> = {};
    if (body.scheduled_at) {
      const d = new Date(body.scheduled_at);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid scheduled_at' }, { status: 400 });
      updates.scheduled_at = d.toISOString();
    }
    if (body.duration_minutes) updates.duration_minutes = Number(body.duration_minutes);
    if (typeof body.meeting_link === 'string' && body.meeting_link.trim()) updates.meeting_link = body.meeting_link.trim();
    if (typeof body.notes === 'string') updates.notes = body.notes;
    if (body.status === 'cancelled') updates.status = 'cancelled';

    if (updates.duration_minutes !== undefined && !(updates.duration_minutes >= 10 && updates.duration_minutes <= 240)) {
      return NextResponse.json({ error: 'Duration must be 10 to 240 minutes.' }, { status: 400 });
    }

    // Keep the Google Calendar event in step; Google tells the candidate and interviewer.
    let warning: string | undefined;
    const conn = db.getSchoolById(existing.school_id)?.google_calendar;
    if (conn && existing.calendar_event_id) {
      try {
        if (updates.status === 'cancelled') await cancelMeetEvent(conn, existing.calendar_event_id);
        else if (updates.scheduled_at || updates.duration_minutes) {
          await moveMeetEvent(conn, existing.calendar_event_id, updates.scheduled_at || existing.scheduled_at, updates.duration_minutes || existing.duration_minutes);
        }
      } catch (err) {
        warning = `Saved here, but the Google Calendar event could not be updated: ${err instanceof Error ? err.message : 'unknown error'}.`;
      }
    }

    const updated = db.updateScheduledInterview(id, updates);

    auditAsStaff(ctx, ctx.schoolId, {
      action: body.status === 'cancelled' ? 'INTERVIEW_CANCELLED' : 'INTERVIEW_RESCHEDULED',
      resource: `Interview: ${id}`,
      details: body.status === 'cancelled' ? 'Cancelled.' : 'Updated time, link, or notes.'
    });

    return NextResponse.json({ success: true, interview: updated, ...(warning ? { warning } : {}) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
  }
}
