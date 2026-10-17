import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Lists a school's own staff — used to populate the "who is taking this
 * interview" dropdown when HR schedules one. School-admin-and-above only:
 * the roster of who works here, and their emails, isn't something every
 * signed-in role needs to see.
 */
export async function GET(req: NextRequest) {
  try {
    const schoolId = new URL(req.url).searchParams.get('school_id');
    const ctx = await requireSchoolAccess(schoolId, { minRole: 'SCHOOL_ADMIN' });

    const rl = checkRateLimit(req, 'list-staff', { max: 120, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests this hour.' }, { status: 429 });
    }

    const staff = db.getUsersBySchool(ctx.schoolId).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
    }));

    return NextResponse.json({ staff });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }
}
