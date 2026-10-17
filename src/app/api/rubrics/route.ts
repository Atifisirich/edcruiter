import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';

/**
 * Rubrics are grading criteria, not assessment content — a candidate who can
 * read this endpoint can read exactly how they will be scored before they
 * answer. Staff-only, at every verb, with no candidate read path.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ctx = await requireSchoolAccess(searchParams.get('school_id'));
    const rubrics = db.getRubricsBySchool(ctx.schoolId);
    return NextResponse.json({ rubrics });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load rubrics' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    const { stage_key, role_type = 'Teacher', subject = 'ALL', segment = 'ALL', dimensions } = body;

    if (!stage_key || !dimensions) {
      return NextResponse.json({ error: 'stage_key and dimensions are required' }, { status: 400 });
    }

    const newRubric = db.addOrUpdateRubric({
      id: `rubric_${stage_key}_${Date.now()}`,
      school_id: ctx.schoolId,
      stage_key,
      role_type,
      subject,
      segment,
      dimensions
    });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'RUBRIC_SAVED',
      resource: `Rubric: ${stage_key}`,
      details: `Saved rubric for ${subject} / ${segment}.`
    });

    return NextResponse.json({ rubric: newRubric });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to save rubric' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ctx = await requireSchoolAccess(searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    db.deleteRubric(ctx.schoolId, id);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'RUBRIC_DELETED',
      resource: `Rubric: ${id}`,
      details: 'Deleted rubric.'
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to delete rubric' }, { status: 500 });
  }
}
