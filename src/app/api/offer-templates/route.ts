import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { parseTemplates } from '@/lib/offerTemplates';

/**
 * The school's own offer letter templates, for HR and the school admin.
 *   GET ?school_id=   the templates
 *   PUT { school_id, templates: [{ id?, name, body }] }   saves the whole list
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { anyOf: HIRING_TEAM });
    return NextResponse.json({ templates: db.getSchoolById(ctx.schoolId)?.offer_letter_templates ?? [] });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the offer letters.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const before = db.getSchoolById(ctx.schoolId)?.offer_letter_templates ?? [];
    const parsed = parseTemplates(body.templates, ctx.user.name, undefined, before);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    db.updateSchool(ctx.schoolId, { offer_letter_templates: parsed.templates });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'OFFER_TEMPLATES_SAVED',
      resource: 'Offer letters',
      details: `${parsed.templates.length} letter${parsed.templates.length === 1 ? '' : 's'}: ${parsed.templates.map((t) => t.name).join(', ') || 'none'}.`,
    });
    return NextResponse.json({ success: true, templates: parsed.templates });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the offer letters.' }, { status: 500 });
  }
}
