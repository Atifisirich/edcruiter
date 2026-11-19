import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { calendarAvailable, calendarConnectUrl } from '@/lib/googleCalendar';
import { createPurposeToken } from '@/lib/session';

/**
 * The school's Google Calendar connection, for real Google Meet links.
 * GET: is it connected, and to which account. POST: where to go to connect.
 * DELETE: disconnect (new interviews then get a Jitsi room).
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'));
    const conn = db.getSchoolById(ctx.schoolId)?.google_calendar;
    return NextResponse.json({
      available: calendarAvailable(),
      connected: !!conn,
      ...(conn ? { email: conn.email, connected_at: conn.connected_at, connected_by_name: conn.connected_by_name } : {}),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the Google connection.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    if (!calendarAvailable()) return NextResponse.json({ error: 'Google is not set up on this server yet.' }, { status: 400 });
    // Signed, short-lived, and tied to this school and person, so a callback cannot be replayed onto another school.
    const state = createPurposeToken('google-calendar', { school_id: ctx.schoolId, user_id: ctx.user.id }, 15 * 60);
    return NextResponse.json({ url: calendarConnectUrl(state, ctx.user.email) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not start the Google connection.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const school = db.getSchoolById(ctx.schoolId);
    if (school?.google_calendar) {
      db.updateSchool(ctx.schoolId, { google_calendar: undefined });
      auditAsStaff(ctx, ctx.schoolId, { action: 'GOOGLE_CALENDAR_DISCONNECTED', resource: `School: ${school.name}`, details: `Disconnected ${school.google_calendar.email}.` });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not disconnect Google.' }, { status: 500 });
  }
}
