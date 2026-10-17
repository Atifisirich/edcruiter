import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { ScheduledInterview } from '@/lib/types';
import { checkRateLimit } from '@/lib/rateLimit';

/** Reschedule or cancel — HR's calendar to change, per "HR decides and allots". */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = db.getScheduledInterviewById(id);
    if (!existing) return NextResponse.json({ error: 'Interview not found' }, { status: 404 });

    const ctx = await requireSchoolAccess(existing.school_id, { minRole: 'SCHOOL_ADMIN' });

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

    const updated = db.updateScheduledInterview(id, updates);

    auditAsStaff(ctx, ctx.schoolId, {
      action: body.status === 'cancelled' ? 'INTERVIEW_CANCELLED' : 'INTERVIEW_RESCHEDULED',
      resource: `Interview: ${id}`,
      details: body.status === 'cancelled' ? 'Cancelled.' : 'Updated time, link, or notes.'
    });

    return NextResponse.json({ success: true, interview: updated });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
  }
}
