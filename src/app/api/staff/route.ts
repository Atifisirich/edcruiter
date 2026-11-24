import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM, actsAsManagement } from '@/lib/permissions';
import { heldRoleIds } from '@/lib/roles';
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
    const ctx = await requireSchoolAccess(schoolId, { anyOf: HIRING_TEAM });

    const rl = checkRateLimit(req, 'list-staff', { max: 120, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests this hour.' }, { status: 429 });
    }

    const school = db.getSchoolById(ctx.schoolId);
    const staff = db.getUsersBySchool(ctx.schoolId).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      role_id: u.role_id ?? u.role,
      department: u.department,
      // An admin who also acts as management holds the management roles too.
      also_management: actsAsManagement(u),
      role_ids: heldRoleIds(school, u),
    }));

    return NextResponse.json({ staff });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load staff' }, { status: 500 });
  }
}
