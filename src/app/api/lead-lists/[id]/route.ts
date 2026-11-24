import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { cleanSetup } from '@/lib/leadSetup';
import { leadListView } from '@/lib/leadListView';
import { cleanMode } from '@/lib/interviewMode';
import { ensureRetrySweeper, runLeadCampaigns } from '@/lib/screeningCallService';
import type { LeadList, ScreeningTemplate } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

/** One lead list: its people with results, the report and the estimate. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'));
    ensureRetrySweeper();
    const list = db.getLeadList(ctx.schoolId, id);
    if (!list) return NextResponse.json({ error: 'List not found.' }, { status: 404 });
    return NextResponse.json(leadListView(ctx.schoolId, list));
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the list.' }, { status: 500 });
  }
}

/**
 * Changes to a list (HR or admin):
 *   { action: 'save_setup', brief, setup, on_good_fit, interview_mode }
 *   { action: 'start' | 'pause' | 'resume' }
 *   { action: 'rename', name }
 *   { action: 'merge', from_id }               move everyone from another list into this one
 *   { action: 'save_template', name }          keep this setup to reuse
 *   { action: 'use_template', template_id }    copy a saved setup into this list
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const list = db.getLeadList(ctx.schoolId, id);
    if (!list) return NextResponse.json({ error: 'List not found.' }, { status: 404 });
    const school = db.getSchoolById(ctx.schoolId);
    const audit = (what: string, details: string) => auditAsStaff(ctx, ctx.schoolId, { action: what, resource: `Lead list: ${list.name}`, details });
    const done = (l: LeadList | undefined) => NextResponse.json(leadListView(ctx.schoolId, l ?? list));

    switch (body.action) {
      case 'save_setup': {
        if (list.status === 'running') return NextResponse.json({ error: 'Pause the calls before changing the questions.' }, { status: 409 });
        const clean = cleanSetup(body.setup, school);
        if (!clean.ok) return NextResponse.json({ error: clean.error }, { status: 400 });
        const goodFit = String(body.setup?.good_fit ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
        const updated = db.updateLeadList(ctx.schoolId, id, {
          brief: String(body.brief ?? list.brief ?? '').slice(0, 1500),
          setup: { ...clean.setup, ...(goodFit ? { good_fit: goodFit } : {}) },
          on_good_fit: body.on_good_fit === 'move' ? 'move' : 'move_and_invite',
          interview_mode: cleanMode(body.interview_mode) ?? list.interview_mode,
        });
        audit('LEAD_LIST_SETUP_SAVED', `${clean.setup.questions.length} questions. Good fit: ${clean.setup.good_fit}`);
        return done(updated);
      }
      case 'start':
      case 'resume': {
        if (!list.setup) return NextResponse.json({ error: 'Set up the screening first.' }, { status: 400 });
        const waiting = db.getLeadsOfList(ctx.schoolId, id).filter((c) => c.lead?.status === 'waiting' || c.lead?.status === 'calling').length;
        if (!waiting) return NextResponse.json({ error: 'Nobody on this list is waiting to be called.' }, { status: 400 });
        const updated = db.updateLeadList(ctx.schoolId, id, { status: 'running', note: undefined, ...(list.started_at ? {} : { started_at: new Date().toISOString() }) });
        audit(body.action === 'start' ? 'LEAD_LIST_STARTED' : 'LEAD_LIST_RESUMED', `Calling ${waiting} people.`);
        after(() => runLeadCampaigns().then(() => undefined));
        return done(updated);
      }
      case 'pause': {
        const updated = db.updateLeadList(ctx.schoolId, id, { status: 'paused', note: undefined });
        audit('LEAD_LIST_PAUSED', 'Calls paused. Calls already ringing finish.');
        return done(updated);
      }
      case 'rename': {
        const name = String(body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (name.length < 2) return NextResponse.json({ error: 'Give the list a name.' }, { status: 400 });
        return done(db.updateLeadList(ctx.schoolId, id, { name }));
      }
      case 'merge': {
        const from = db.getLeadList(ctx.schoolId, String(body.from_id ?? ''));
        if (!from || from.id === id) return NextResponse.json({ error: 'Choose another list to bring in.' }, { status: 400 });
        if (from.status === 'running') return NextResponse.json({ error: `Pause “${from.name}” first.` }, { status: 409 });
        const people = db.getLeadsOfList(ctx.schoolId, from.id);
        for (const c of people) db.updateCandidate(ctx.schoolId, c.id, { lead: { ...c.lead!, list_id: id } });
        db.removeEmptyLeadList(ctx.schoolId, from.id);
        audit('LEAD_LISTS_MERGED', `Brought ${people.length} people in from “${from.name}”.`);
        return done(db.updateLeadList(ctx.schoolId, id, { merged_from: [...(list.merged_from ?? []), from.name], ...(list.status === 'done' ? { status: 'paused' } : {}) }));
      }
      case 'save_template': {
        if (!list.setup) return NextResponse.json({ error: 'Set up the screening first.' }, { status: 400 });
        const name = String(body.name ?? list.setup.good_fit).replace(/\s+/g, ' ').trim().slice(0, 60);
        const template: ScreeningTemplate = { id: `tpl_${Date.now().toString(36)}`, name, brief: list.brief ?? '', setup: list.setup, created_at: new Date().toISOString() };
        db.updateSchool(ctx.schoolId, { screening_templates: [template, ...(school?.screening_templates ?? []).filter((t) => t.name !== name)].slice(0, 30) });
        audit('SCREENING_TEMPLATE_SAVED', `Saved “${name}”.`);
        return done(list);
      }
      case 'use_template': {
        if (list.status === 'running') return NextResponse.json({ error: 'Pause the calls first.' }, { status: 409 });
        const t = (school?.screening_templates ?? []).find((x) => x.id === body.template_id);
        if (!t) return NextResponse.json({ error: 'That saved screening is gone.' }, { status: 404 });
        return done(db.updateLeadList(ctx.schoolId, id, { brief: t.brief, setup: { ...t.setup, generated_at: new Date().toISOString() } }));
      }
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not change the list.' }, { status: 500 });
  }
}
