import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';

function schoolIdParam(req: NextRequest) {
  return new URL(req.url).searchParams.get('school_id');
}

/** The signed-in person's own notices, newest first, and how many are unread. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req));
    const notifications = db.getNotificationsForUser(ctx.schoolId, ctx.user.id, 30);
    return NextResponse.json({ notifications, unread: notifications.filter((n) => !n.read_at).length });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load notices.' }, { status: 500 });
  }
}

/** Marks some notices, or all of them, as read. Only the person's own are touched. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req));
    const body = await req.json().catch(() => ({}));
    const ids: string[] | 'all' = body.all === true ? 'all' : Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string').slice(0, 100) : [];
    db.markNotificationsRead(ctx.user.id, ids);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not update notices.' }, { status: 500 });
  }
}
