import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AssessmentPack } from '@/lib/types';
import { generateAssessmentPackData } from '@/lib/assessmentPackGenerator';
import { sanitizeForCandidate, savePackWithRubrics } from '@/lib/ensurePack';
import { authErrorResponse, auditAsStaff, requireCandidate, requireSchoolAccess, AuthError, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(req: NextRequest) {
  try {
    const schoolId = new URL(req.url).searchParams.get('school_id');
    if (!schoolId) return NextResponse.json({ error: 'school_id is required' }, { status: 400 });

    try {
      const candidate = await requireCandidate();
      if (candidate.schoolId !== schoolId) throw new AuthError('Not your school.', 403);
      const packs = db.getAssessmentPacksBySchool(schoolId).map(sanitizeForCandidate);
      return NextResponse.json({ packs });
    } catch {
      const ctx = await requireSchoolAccess(schoolId);
      return NextResponse.json({ packs: db.getAssessmentPacksBySchool(ctx.schoolId) });
    }
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load assessment packs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    assertSchoolActive(ctx.schoolId);

    const rl = checkRateLimit(req, 'assessment-pack-generate', { max: 15, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Generation limit reached for this hour.' }, { status: 429 });
    }

    const subject = body.subject || 'Physics';
    const segment = body.segment || 'Primary (Grades 1–5)';
    const board = body.board || 'CBSE';
    const save = body.save !== false;

    const data = await generateAssessmentPackData({ subject, segment, board });
    const pack: AssessmentPack = save
      ? savePackWithRubrics(ctx.schoolId, data, 'draft', body.title)
      : { id: `pack_${Date.now()}`, ...data, school_id: ctx.schoolId, title: body.title || data.title, status: 'draft', created_at: new Date().toISOString() };

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'ASSESSMENT_PACK_GENERATED',
      resource: `Assessment pack: ${subject} / ${segment}`,
      details: `Generated ${pack.mcqs.length} MCQs and 3 stage rubrics.`
    });

    return NextResponse.json({ success: true, pack });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to generate test' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const existing = db.getAssessmentPackById(body.id);
    if (!existing) return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(existing.school_id, { minRole: 'SCHOOL_ADMIN' });

    const updated = db.updateAssessmentPack(body.id, body.updates || { status: body.status });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'ASSESSMENT_PACK_UPDATED',
      resource: `Assessment pack: ${body.id}`,
      details: 'Updated status/fields.'
    });
    return NextResponse.json({ pack: updated });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update pack' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const existing = db.getAssessmentPackById(id);
    if (!existing) return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(existing.school_id, { minRole: 'SCHOOL_ADMIN' });

    const ok = db.deleteAssessmentPack(id);
    if (!ok) return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'ASSESSMENT_PACK_DELETED',
      resource: `Assessment pack: ${id}`,
      details: 'Deleted assessment pack.'
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to delete test' }, { status: 500 });
  }
}
