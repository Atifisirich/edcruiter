import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { MAX_ROLE_NAMES } from '@/lib/planLimits';
import { parseRoles, rolesOf } from '@/lib/roles';
import { ROLE_HELP, ROLE_LABEL, TEAM_ROLES } from '@/lib/team';

function schoolIdParam(req: NextRequest) {
  return new URL(req.url).searchParams.get('school_id');
}

/** The school's role names, and what each access level allows. Any signed-in member may read them. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req));
    const school = db.getSchoolById(ctx.schoolId);
    return NextResponse.json({
      roles: rolesOf(school),
      max: MAX_ROLE_NAMES,
      levels: TEAM_ROLES.map((level) => ({ level, label: ROLE_LABEL[level], help: ROLE_HELP[level] })),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load roles.' }, { status: 500 });
  }
}

/** Saves the school's role names. Admin only. This is the only way the list is written. */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const body = await req.json().catch(() => null);
    const members = db.getUsersBySchool(ctx.schoolId);
    const parsed = parseRoles(body?.roles, members);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const updated = db.updateSchool(ctx.schoolId, { roles: parsed.roles });
    if (!updated) return NextResponse.json({ error: 'School not found.' }, { status: 404 });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'ROLES_UPDATED',
      resource: `School: ${updated.name}`,
      details: `Role names are now: ${parsed.roles.map((r) => r.name).join(', ')}.`,
    });
    return NextResponse.json({ roles: parsed.roles });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save roles.' }, { status: 500 });
  }
}
