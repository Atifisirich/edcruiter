import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { MAX_PAY_FILE_BYTES, readPayFile } from '@/lib/payGuideImportFile';
import type { PayBasis } from '@/lib/payGuideImport';

/**
 * Reads a pay sheet (Excel, CSV or PDF) the school admin uploads and returns the
 * jobs found, to look over before they are put in the Pay Guide. Nothing is saved
 * here, and the file is thrown away after it is read.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const ctx = await requireSchoolAccess(String(form.get('school_id') || ''), { minRole: 'SCHOOL_ADMIN' });
    assertSchoolActive(ctx.schoolId);

    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose your pay sheet first.' }, { status: 400 });
    if (file.size === 0) return NextResponse.json({ error: 'This file is empty.' }, { status: 400 });
    if (file.size > MAX_PAY_FILE_BYTES) return NextResponse.json({ error: 'This file is larger than 5 MB. Remove extra sheets or pictures and try again.' }, { status: 400 });

    const rl = checkRateLimit(req, 'pay-guide-import', { max: 30, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'You have read a lot of sheets this hour. Try again later.' }, { status: 429 });

    const school = db.getSchoolById(ctx.schoolId);
    const branches = (school?.branches ?? []).map((b) => ({ id: b.id, name: b.name }));
    const wanted = String(form.get('branch') || '');
    const basisRaw = String(form.get('basis') || 'auto');
    const basis: PayBasis = basisRaw === 'monthly' || basisRaw === 'yearly' ? basisRaw : 'auto';

    const result = await readPayFile(new Uint8Array(await file.arrayBuffer()), file.name, {
      subjects: school?.subjects ?? [],
      branches,
      branch: branches.some((b) => b.id === wanted) ? wanted : '',
      basis,
    });
    if (result.error) return NextResponse.json({ error: result.error, notes: result.notes }, { status: 422 });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'PAY_GUIDE_SHEET_READ',
      resource: `School: ${school?.name ?? ctx.schoolId}`,
      details: `Read ${result.roles.length} ${result.roles.length === 1 ? 'job' : 'jobs'} from a pay sheet${result.method === 'ai' ? ' with AI' : ''}. Nothing was saved until the admin confirmed.`,
    });
    return NextResponse.json({ roles: result.roles, notes: result.notes, method: result.method });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not read this file.' }, { status: 500 });
  }
}
