import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { generateSetup } from '@/lib/leadSetup';
import { screeningSettingsOf } from '@/lib/screeningCall';
import type { LeadScreeningSetup } from '@/lib/types';

/**
 * Makes a screening from HR's own words, or changes the current one.
 *   POST { school_id, brief }                      a fresh setup
 *   POST { school_id, brief, current, change }     only the change she asks for
 * Nothing is saved: HR looks it over and saves it.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'lead-setup', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many tries this hour. Edit the questions by hand, or try later.' }, { status: 429 });
    const list = db.getLeadList(ctx.schoolId, id);
    const school = db.getSchoolById(ctx.schoolId);
    if (!list || !school) return NextResponse.json({ error: 'List not found.' }, { status: 404 });
    const current = body.current && typeof body.current === 'object' ? body.current as LeadScreeningSetup : undefined;
    const change = typeof body.change === 'string' ? body.change.slice(0, 600) : undefined;
    const s = screeningSettingsOf(school);
    const result = await generateSetup({
      brief: String(body.brief ?? ''),
      school,
      current: current && change ? current : undefined,
      change,
      // Without the AI: the school's own call questions, to edit by hand.
      fallback: () => ({ questions: s.questions, requirements: s.requirements, importance: s.importance, language: 'English', good_fit: String(body.brief ?? '').slice(0, 300), generated_at: new Date().toISOString() }),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ name: result.name, setup: result.setup });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not make the questions.' }, { status: 500 });
  }
}
