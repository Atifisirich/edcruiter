import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError, auditAsStaff, authErrorResponse, requireCandidate, requireSchoolAccess } from '@/lib/auth';
import { asksPolicyQuestions, parsePolicyQuestions, policyQuestionsOf } from '@/lib/policyVideo';
import { removeVideoFiles } from '@/lib/policyVideoStore';

/**
 * The school's policy video (its details, not the bytes: see ./stream) and the
 * "Do you agree…?" questions asked after it in stage 5.
 *
 *   GET    ?school_id=…   the video, the questions, and whether they are asked
 *   PUT    ?school_id=…   save the school's own questions (admin)
 *   DELETE ?school_id=…   remove the video (admin)
 */

async function requireReader(schoolId: string) {
  try {
    const candidate = await requireCandidate();
    if (candidate.schoolId !== schoolId) throw new AuthError('Not your school.', 403);
  } catch {
    await requireSchoolAccess(schoolId);
  }
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = new URL(req.url).searchParams.get('school_id');
    if (!schoolId) return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
    await requireReader(schoolId);
    const school = db.getSchoolById(schoolId);
    const video = school?.policy_video;
    return NextResponse.json({
      video: video ? { id: video.id, title: video.title, size: video.size, mime: video.mime, uploaded_at: video.uploaded_at, uploaded_by: video.uploaded_by } : null,
      questions: policyQuestionsOf(school),
      custom_questions: !!school?.policy_questions?.length,
      asks_questions: asksPolicyQuestions(school),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the policy video.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const body = await req.json().catch(() => null);
    const parsed = parsePolicyQuestions(body?.questions);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = db.updateSchool(ctx.schoolId, { policy_questions: parsed.questions });
    if (!updated) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'POLICY_QUESTIONS_UPDATED',
      resource: `School: ${updated.name}`,
      details: `Saved ${parsed.questions.length} policy questions for stage 5.`,
    });
    return NextResponse.json({ questions: parsed.questions, asks_questions: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the questions.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const school = db.getSchoolById(ctx.schoolId);
    const video = school?.policy_video;
    if (!video) return NextResponse.json({ error: 'There is no policy video.' }, { status: 404 });
    db.updateSchool(ctx.schoolId, { policy_video: undefined });
    removeVideoFiles(video);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'POLICY_VIDEO_REMOVED',
      resource: `School: ${school?.name}`,
      details: `Removed the policy video "${video.title}".`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not remove the video.' }, { status: 500 });
  }
}
