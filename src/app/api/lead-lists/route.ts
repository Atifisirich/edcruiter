import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { leadListSummary } from '@/lib/leadListView';
import { ensureRetrySweeper } from '@/lib/screeningCallService';
import type { LeadList } from '@/lib/types';

/**
 * Lead lists: bulk uploads to screen by AI phone call, kept apart from candidates.
 *   GET  ?school_id=…                      the school's lists with their counts, and saved screening templates
 *   POST { school_id, name }               a new, empty list (HR or admin)
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'));
    ensureRetrySweeper();
    const lists = db.getLeadLists(ctx.schoolId).map((l) => leadListSummary(ctx.schoolId, l));
    const templates = (db.getSchoolById(ctx.schoolId)?.screening_templates ?? []).map((t) => ({ id: t.id, name: t.name, brief: t.brief, good_fit: t.setup.good_fit, questions: t.setup.questions.length }));
    return NextResponse.json({ lists, templates });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the lead lists.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const name = String(body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (name.length < 2) return NextResponse.json({ error: 'Give the list a name, such as “November job portal leads”.' }, { status: 400 });
    const now = new Date().toISOString();
    const list: LeadList = {
      id: `ll_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      school_id: ctx.schoolId,
      name,
      created_by: ctx.user.name,
      created_at: now,
      updated_at: now,
      status: 'setup',
      on_good_fit: 'move_and_invite',
    };
    db.addLeadList(list);
    auditAsStaff(ctx, ctx.schoolId, { action: 'LEAD_LIST_CREATED', resource: `Lead list: ${name}`, details: 'Created a lead list.' });
    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not create the list.' }, { status: 500 });
  }
}
