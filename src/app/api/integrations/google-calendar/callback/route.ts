import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, getStaffContext } from '@/lib/auth';
import { appOrigin } from '@/lib/googleOAuth';
import { connectionFromCode } from '@/lib/googleCalendar';
import { isAdmin } from '@/lib/permissions';
import { readPurposeToken } from '@/lib/session';

/** Google sends the admin back here after they allow (or refuse) calendar access. */
export async function GET(req: NextRequest) {
  const back = (result: string) => NextResponse.redirect(`${appOrigin()}/admin/settings?google=${encodeURIComponent(result)}#interviews`);
  const params = req.nextUrl.searchParams;
  if (params.get('error')) return back('cancelled');

  const state = readPurposeToken(params.get('state') || undefined, 'google-calendar');
  const code = params.get('code');
  if (!state?.school_id || !code) return back('failed');

  // The person coming back must be the same signed-in admin who started it.
  const ctx = await getStaffContext();
  if (!ctx || ctx.user.id !== state.user_id || (!ctx.isSuperAdmin && (ctx.schoolId !== state.school_id || !isAdmin(ctx.role)))) return back('failed');

  try {
    const conn = await connectionFromCode(code, ctx.user.name);
    const school = db.updateSchool(state.school_id, { google_calendar: conn });
    auditAsStaff(ctx, state.school_id, { action: 'GOOGLE_CALENDAR_CONNECTED', resource: `School: ${school?.name ?? state.school_id}`, details: `Interviews now get Google Meet links from ${conn.email}.` });
    return back('connected');
  } catch (err) {
    console.warn('Google Calendar connection failed:', err instanceof Error ? err.message : err);
    return back(err instanceof Error && /lasting permission/.test(err.message) ? 'no_refresh' : err instanceof Error && /Calendar permission/.test(err.message) ? 'no_scope' : 'failed');
  }
}
