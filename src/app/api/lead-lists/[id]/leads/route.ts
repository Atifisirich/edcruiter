import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { importLeads, type LeadRow } from '@/lib/leadActions';
import { leadListView } from '@/lib/leadListView';

/**
 * Adds people to a lead list from a spreadsheet the school uploaded.
 *   POST { school_id, school_attested: true, rows: [{ name, phone, email?, subject?, segment?, ... }] }
 * A name and a phone number are enough. Anyone the school already has (same
 * phone) is skipped and listed back, never added twice.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    if (body.school_attested !== true) {
      return NextResponse.json({ error: 'Confirm that the school has permission to contact these people before adding them.' }, { status: 400 });
    }
    const list = db.getLeadList(ctx.schoolId, id);
    if (!list) return NextResponse.json({ error: 'List not found.' }, { status: 404 });
    const rows: LeadRow[] = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ error: 'The file has no rows.' }, { status: 400 });
    if (rows.length > 5000) return NextResponse.json({ error: 'Up to 5,000 people at a time. Split the file and add the rest after.' }, { status: 400 });
    const result = importLeads(list, rows, ctx.user.branch_id);
    // A finished list with new people is ready to call again.
    if (result.added && list.status === 'done') db.updateLeadList(ctx.schoolId, id, { status: 'paused' });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'LEADS_IMPORTED',
      resource: `Lead list: ${list.name}`,
      details: `Added ${result.added} people with school-attested permission to contact them. Skipped ${result.skipped.length}.`,
    });
    return NextResponse.json({ ...result, view: leadListView(ctx.schoolId, db.getLeadList(ctx.schoolId, id) ?? list) }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not add the people.' }, { status: 500 });
  }
}
