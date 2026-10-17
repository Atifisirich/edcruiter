import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireCandidate, requireSchoolAccess } from '@/lib/auth';
import { AuthError } from '@/lib/auth';

/** Read access: the candidate sitting the assessment for this school, or staff of it. */
async function requireReader(schoolId: string) {
  try {
    const candidate = await requireCandidate();
    if (candidate.schoolId !== schoolId) throw new AuthError('Not your school.', 403);
    return;
  } catch {
    await requireSchoolAccess(schoolId);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');
    if (!schoolId) return NextResponse.json({ error: 'school_id is required' }, { status: 400 });

    await requireReader(schoolId);

    const subject = searchParams.get('subject') || undefined;
    const segment = searchParams.get('segment') || undefined;
    const items = db.getQuestionnairesBySchool(schoolId, subject, segment);
    return NextResponse.json({ questionnaires: items });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load questionnaires' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    const { stage_key, subject, segment, type, question_text, options, correct_option, rubric_hint } = body;

    if (!stage_key || !question_text) {
      return NextResponse.json({ error: 'stage_key and question_text are required' }, { status: 400 });
    }

    const newItem = db.addOrUpdateQuestionnaire({
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      school_id: ctx.schoolId,
      stage_key,
      subject: subject || 'ALL',
      segment: segment || 'ALL',
      type: type || 'mcq',
      question_text,
      options,
      correct_option,
      rubric_hint,
      created_at: new Date().toISOString()
    });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'QUESTIONNAIRE_ITEM_ADDED',
      resource: `Questionnaire: ${stage_key}`,
      details: `Added a ${type || 'mcq'} item for ${subject || 'ALL'} / ${segment || 'ALL'}.`
    });

    return NextResponse.json({ questionnaire: newItem });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to create questionnaire item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ctx = await requireSchoolAccess(searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    db.deleteQuestionnaire(ctx.schoolId, id);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'QUESTIONNAIRE_ITEM_DELETED',
      resource: `Questionnaire: ${id}`,
      details: 'Removed questionnaire item.'
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to delete questionnaire item' }, { status: 500 });
  }
}
