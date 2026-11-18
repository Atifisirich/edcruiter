import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireStaff } from '@/lib/auth';

/**
 * Support mode: the platform owner opening one school's hiring dashboard.
 *
 * A super admin can already act on any school by naming it; this records the
 * moment they step into a school's workspace (and out of it) in that school's
 * own activity log, so the school can see when Edcruiter looked at their data.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireStaff();
    if (!ctx.isSuperAdmin) {
      return NextResponse.json({ error: 'Only the platform owner can use support mode.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const schoolId = typeof body.school_id === 'string' ? body.school_id.trim() : '';
    const school = schoolId ? db.getSchoolById(schoolId) : undefined;
    if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 });

    const leaving = body.action === 'exit';
    auditAsStaff(ctx, school.id, {
      action: leaving ? 'SUPPORT_MODE_EXITED' : 'SUPPORT_MODE_ENTERED',
      resource: `School: ${school.name}`,
      details: leaving
        ? `${ctx.user.name} (Edcruiter support) left this school's workspace.`
        : `${ctx.user.name} (Edcruiter support) opened this school's workspace in support mode.`
    });
    return NextResponse.json({ success: true, school: { id: school.id, name: school.name } });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not start support mode.' }, { status: 500 });
  }
}
