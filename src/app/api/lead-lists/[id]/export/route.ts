import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { leadListView } from '@/lib/leadListView';
import { leadsCsv } from '@/lib/leadLists';

/** The list as a spreadsheet (CSV): everyone, their result, the reason and the call summary. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { anyOf: HIRING_TEAM });
    const list = db.getLeadList(ctx.schoolId, id);
    if (!list) return NextResponse.json({ error: 'List not found.' }, { status: 404 });
    const view = leadListView(ctx.schoolId, list);
    const csv = leadsCsv(view.rows.map((r) => ({
      name: r.name, phone: r.phone, email: r.email, subject: r.subject, status: r.status_label, reason: r.reason ?? '',
      summary: r.summary ?? '', called_at: r.called_at ? new Date(r.called_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
    })));
    auditAsStaff(ctx, ctx.schoolId, { action: 'LEAD_LIST_EXPORTED', resource: `Lead list: ${list.name}`, details: `Downloaded ${view.rows.length} rows.` });
    const file = `${list.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'lead-list'}.csv`;
    return new NextResponse(`﻿${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file}"` } });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not export the list.' }, { status: 500 });
  }
}
