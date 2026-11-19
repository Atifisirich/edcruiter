import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM, isAdmin } from '@/lib/permissions';
import { cleanPackEdits, ownQuestionsProblem, sameQuestions } from '@/lib/packEdit';
import { MIN_OWN_QUESTIONS } from '@/lib/ownTest';
import type { AssessmentPack, StageKey } from '@/lib/types';

/** Which scoring stage each written guide belongs to, matching how the guides are saved when a test is written. */
const RUBRIC_STAGE: Record<'lesson_rubric' | 'demo_rubric' | 'scenario_rubric', StageKey> = {
  lesson_rubric: 'written_theory',
  demo_rubric: 'micro_teaching_demo',
  scenario_rubric: 'situational_scenario',
};

/**
 * Change a written test by hand: any question, the three tasks and their
 * scoring guides, and where candidates' questions come from. The school admin
 * and HR may edit a test that is not in use; changing a live test is the
 * admin's, because candidates start taking it straight away.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pack = db.getAssessmentPackById(id);
    if (!pack) return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(pack.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);

    if (pack.status === 'active' && !isAdmin(ctx.role)) {
      return NextResponse.json({ error: 'This test is in use. Only the school admin can change a test that candidates are taking.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const checked = cleanPackEdits(body);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    const updates: Partial<AssessmentPack> = { ...checked.updates };
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'There was nothing to save.' }, { status: 400 });

    // Edits to the questions have to reach candidates, so a test that never chose a source starts using its own questions,
    // as long as it has enough of them.
    const questionsChanged = updates.mcqs !== undefined && !sameQuestions(updates.mcqs, pack.mcqs);
    let switchedOn = false;
    if (questionsChanged && pack.use_own_questions === undefined && updates.use_own_questions === undefined
        && (updates.mcqs?.length ?? 0) >= MIN_OWN_QUESTIONS) {
      updates.use_own_questions = true;
      switchedOn = true;
    }

    const merged = { ...pack, ...updates };
    const problem = ownQuestionsProblem(merged);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    updates.edited_at = new Date().toISOString();
    const saved = db.updateAssessmentPack(id, updates);

    // The scoring guides are also kept as the rubric the marking reads, so a changed guide must change there too.
    for (const key of Object.keys(RUBRIC_STAGE) as (keyof typeof RUBRIC_STAGE)[]) {
      const text = updates[key];
      if (text === undefined || text === pack[key]) continue;
      const stage_key = RUBRIC_STAGE[key];
      db.addOrUpdateRubric({
        id: `rubric_${pack.id}_${stage_key}`,
        school_id: pack.school_id,
        stage_key,
        role_type: 'Teacher',
        subject: pack.subject,
        segment: pack.segment,
        dimensions: [{ id: 'ai_generated', name: 'Edcruiter AI rubric', description: text, weight: 100 }],
      });
    }

    const changed = Object.keys(updates).filter((k) => k !== 'edited_at');
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'ASSESSMENT_PACK_EDITED',
      resource: `Assessment pack: ${pack.title}`,
      details: `Changed ${changed.join(', ')}${pack.status === 'active' ? ' on a test in use' : ''}.`,
    });

    return NextResponse.json({ success: true, pack: saved, switched_to_own_questions: switchedOn });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the test.' }, { status: 500 });
  }
}
