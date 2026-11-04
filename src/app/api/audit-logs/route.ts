import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireStaff } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedSchoolId = searchParams.get('school_id');
    const ctx = await requireStaff();

    if (ctx.isSuperAdmin) {
      // Super admin may request one school's log or, by omitting school_id,
      // the platform-wide log.
      return NextResponse.json({ auditLogs: db.getAuditLogs(requestedSchoolId) });
    }

    // The log is how the school admin follows everyone's work, so it is theirs
    // alone. They see only their own school's log — a requested school_id
    // belonging to someone else is silently ignored, not honoured.
    if (!isAdmin(ctx.role)) {
      return NextResponse.json({ error: 'Only the school admin can see the team’s activity.' }, { status: 403 });
    }
    if (!ctx.schoolId) {
      throw new Error('Staff account is not linked to a school.');
    }
    return NextResponse.json({ auditLogs: db.getAuditLogs(ctx.schoolId) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
