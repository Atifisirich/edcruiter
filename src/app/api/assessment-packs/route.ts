import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/db';
import { AssessmentPack, StageKey } from '@/lib/types';
import { buildFallbackMcqs, buildFallbackPack } from '@/lib/buildAssessmentPack';
import { authErrorResponse, auditAsStaff, requireCandidate, requireSchoolAccess, AuthError } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Strips the answer key and grading rubrics before a pack reaches a candidate.
 * The previous version sent mcqs[].correct_option and every stage rubric to
 * the browser verbatim — a candidate could open devtools and read both the
 * quiz answers and the exact criteria they would be scored against before
 * (or during) the assessment.
 */
function sanitizeForCandidate(pack: AssessmentPack) {
  return {
    ...pack,
    mcqs: (pack.mcqs || []).map(({ correct_option: _correct_option, explanation: _explanation, ...rest }) => rest),
    lesson_rubric: undefined,
    demo_rubric: undefined,
    scenario_rubric: undefined,
  };
}

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

    const rl = checkRateLimit(req, 'assessment-pack-generate', { max: 15, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Generation limit reached for this hour.' }, { status: 429 });
    }

    const subject = body.subject || 'Physics';
    const segment = body.segment || 'Primary (Grades 1–5)';
    const board = body.board || 'CBSE';
    const save = body.save !== false;

    const fallback = buildFallbackPack({ school_id: ctx.schoolId, subject, segment, board });
    let packData = { ...fallback };

    if (ai) {
      try {
        const prompt = `You are a school academic director writing a teacher hiring assessment.
Create ONE JSON object (no markdown) for hiring a ${subject} teacher for ${segment} on the ${board} board.

Required keys:
{
  "mcqs": [ 25 objects with id, question_text, options (4 strings), correct_option (must match one option), explanation ],
  "lesson_prompt": "lesson plan task for the candidate",
  "lesson_rubric": "how AI should score the lesson plan, 1-10 dimensions",
  "demo_prompt": "5-minute live teaching demo prompt",
  "demo_rubric": "how AI should score the demo",
  "scenario_prompt": "classroom scenario the candidate answers on camera",
  "scenario_rubric": "how AI should score the scenario"
}

MCQs must be about teaching ${subject} to ${segment}, not trivia for children. Mix pedagogy and subject knowledge.`;

        let response;
        try {
          response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
        } catch {
          response = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt });
        }
        const raw = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const mcqs = Array.isArray(parsed.mcqs) ? parsed.mcqs : [];
          const normalized = mcqs.map((q: any, i: number) => ({
            id: q.id || `mcq_${i + 1}`,
            question_text: q.question_text,
            options: q.options || [],
            correct_option: q.correct_option,
            explanation: q.explanation
          })).filter((q: any) => q.question_text && q.options?.length >= 2);
          const padded = [
            ...normalized,
            ...buildFallbackMcqs(subject, segment, board, 25)
          ].slice(0, 25);
          packData = {
            ...fallback,
            mcqs: padded,
            lesson_prompt: parsed.lesson_prompt || fallback.lesson_prompt,
            lesson_rubric: parsed.lesson_rubric || fallback.lesson_rubric,
            demo_prompt: parsed.demo_prompt || fallback.demo_prompt,
            demo_rubric: parsed.demo_rubric || fallback.demo_rubric,
            scenario_prompt: parsed.scenario_prompt || fallback.scenario_prompt,
            scenario_rubric: parsed.scenario_rubric || fallback.scenario_rubric
          };
        }
      } catch (err) {
        console.warn('Assessment pack Gemini fallback:', err);
      }
    }

    const pack: AssessmentPack = {
      id: `pack_${Date.now()}`,
      ...packData,
      title: body.title || packData.title,
      status: 'draft',
      created_at: new Date().toISOString()
    };

    const saved = save ? db.createAssessmentPack(pack) : pack;

    ['written_theory', 'micro_teaching_demo', 'situational_scenario'].forEach((stage_key, idx) => {
      const rubricText = idx === 0 ? pack.lesson_rubric : idx === 1 ? pack.demo_rubric : pack.scenario_rubric;
      db.addOrUpdateRubric({
        id: `rubric_${pack.id}_${stage_key}`,
        school_id: ctx.schoolId,
        stage_key: stage_key as StageKey,
        role_type: 'Teacher',
        subject,
        segment,
        dimensions: [
          { id: 'ai_generated', name: 'Edcruiter AI rubric', description: rubricText, weight: 100 }
        ]
      });
    });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'ASSESSMENT_PACK_GENERATED',
      resource: `Assessment pack: ${subject} / ${segment}`,
      details: `Generated ${packData.mcqs?.length ?? 0} MCQs and 3 stage rubrics.`
    });

    return NextResponse.json({ success: true, pack: saved });
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
