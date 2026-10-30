import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/db';
import { HRPolicyDocument } from '@/lib/types';
import { authErrorResponse, auditAsStaff, requireCandidate, requireSchoolAccess, AuthError, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/** The candidate sitting stage 5 needs to read the policy; staff need it to manage it. */
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
    const schoolId = new URL(req.url).searchParams.get('school_id');
    if (!schoolId) return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
    await requireReader(schoolId);
    return NextResponse.json({ policies: db.getHRPoliciesBySchool(schoolId) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load policies' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

    if (body.generate) {
      assertSchoolActive(ctx.schoolId);
      const rl = checkRateLimit(req, 'hr-policy-generate', { max: 20, windowMs: 60 * 60_000 });
      if (!rl.allowed) {
        return NextResponse.json({ error: 'Generation limit reached for this hour.' }, { status: 429 });
      }
    }

    let title = body.title || 'School staff policy';
    let content = body.content || '';
    const category = body.category || 'general';

    if (body.generate && ai) {
      try {
        const prompt = `Write a short, plain-language school HR policy for Indian K-12 teachers.
Topic: ${title || body.topic || 'code of conduct, working hours, notice period, and child safeguarding'}.
Return JSON only: {"title":"...","content":"numbered points, max 400 words, no legal jargon dump"}`;
        let response;
        try {
          response = await ai.models.generateContent({ model: 'gemini-3.5-flash', contents: prompt });
        } catch {
          response = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt });
        }
        const raw = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          title = parsed.title || title;
          content = parsed.content || content;
        }
      } catch (e) {
        console.warn('Policy generate fallback', e);
      }
    }

    if (!content.trim()) {
      content = `1. Teachers follow the school's child safeguarding code.\n2. Working hours are set by the campus principal.\n3. A 60-day notice period applies after confirmation.\n4. Mid-term resignations are not accepted.`;
    }

    const doc: HRPolicyDocument = {
      id: `policy_${Date.now()}`,
      school_id: ctx.schoolId,
      title,
      content,
      category,
      required: body.required !== false,
      uploaded_at: new Date().toISOString()
    };
    const saved = db.addHRPolicy(doc);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'HR_POLICY_SAVED',
      resource: `Policy: ${title}`,
      details: body.generate ? 'Generated and saved via AI.' : 'Saved manually.'
    });
    return NextResponse.json({ success: true, policy: saved });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save policy' }, { status: 500 });
  }
}

/** Full control over an existing policy — edit its text, or flip whether a candidate must acknowledge it. */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

    const updates: Partial<HRPolicyDocument> = {};
    if (typeof body.title === 'string') updates.title = body.title;
    if (typeof body.content === 'string') updates.content = body.content;
    if (typeof body.category === 'string') updates.category = body.category;
    if (typeof body.required === 'boolean') updates.required = body.required;

    const updated = db.updateHRPolicy(ctx.schoolId, body.id, updates);
    if (!updated) return NextResponse.json({ error: 'Policy not found' }, { status: 404 });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'HR_POLICY_UPDATED',
      resource: `Policy: ${updated.title}`,
      details: 'Updated policy content or requirements.'
    });
    return NextResponse.json({ success: true, policy: updated });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update policy' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get('id');
    const schoolId = new URL(req.url).searchParams.get('school_id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const ctx = await requireSchoolAccess(schoolId, { minRole: 'SCHOOL_ADMIN' });

    const ok = db.deleteHRPolicy(ctx.schoolId, id);
    if (!ok) return NextResponse.json({ error: 'Policy not found' }, { status: 404 });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'HR_POLICY_DELETED',
      resource: `Policy: ${id}`,
      details: 'Removed policy.'
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to delete policy' }, { status: 500 });
  }
}
