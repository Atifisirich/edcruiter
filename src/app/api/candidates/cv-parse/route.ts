import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { readCv } from '@/lib/cvIntake';
import type { CvLead } from '@/lib/cvLead';

const MAX_FILES_PER_REQUEST = 5;
const MAX_CV_BYTES = 10 * 1024 * 1024;

type CvRowResult =
  | { filename: string; ok: true; lead: CvLead }
  | { filename: string; ok: false; error: string };

/**
 * Reads CV PDFs and returns the details found, for the school to review and
 * import. Nothing is saved here: the files are read by the AI and discarded, and
 * a candidate is only created when the school confirms the import.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const ctx = await requireSchoolAccess(String(form.get('school_id') || ''), { minRole: 'SCHOOL_ADMIN' });
    assertSchoolActive(ctx.schoolId);

    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: 'Choose at least one CV (PDF).' }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json({ error: `Send at most ${MAX_FILES_PER_REQUEST} CVs at a time.` }, { status: 400 });
    }

    // Each request is up to five AI calls, so 60 an hour allows about 300 CVs.
    const rl = checkRateLimit(req, 'cv-intake', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'You have read a lot of CVs this hour. Try again later.' }, { status: 429 });
    }

    const school = db.getSchoolById(ctx.schoolId);
    const intake = { subjects: school?.subjects || [], segments: school?.segments || [] };

    const results: CvRowResult[] = [];
    for (const file of files) {
      if (file.size > MAX_CV_BYTES) {
        results.push({ filename: file.name, ok: false, error: 'This file is larger than 10 MB.' });
        continue;
      }
      const read = await readCv(Buffer.from(await file.arrayBuffer()), file.name, intake);
      results.push({ filename: file.name, ...read } as CvRowResult);
    }

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'CV_INTAKE_READ',
      resource: `${results.filter((r) => r.ok).length} of ${files.length} CVs`,
      details: 'CVs read by AI for the import preview. Nothing was stored.'
    });

    return NextResponse.json({ results });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not read these CVs.' }, { status: 500 });
  }
}
