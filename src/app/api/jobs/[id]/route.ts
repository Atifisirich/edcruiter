import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { cleanGrades, segmentFromGrades } from '@/lib/grades';
import type { PublicVacancy } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = db.getJobById(id);
    // A vacancy of a school that is not approved, or one the school has closed, is not public.
    if (!job || job.status === 'closed' || !db.isSchoolActive(job.school_id)) {
      return NextResponse.json({ error: 'Vacancy not found' }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: 'Failed to load vacancy' }, { status: 500 });
  }
}

const text = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const lines = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim().slice(0, 400) : '')).filter(Boolean).slice(0, 30) : undefined;

/** Edit a vacancy. The school admin and HR may; only the fields below can change. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = db.getJobById(id);
    if (!job) return NextResponse.json({ error: 'Vacancy not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(job.school_id, { anyOf: HIRING_TEAM });
    const body = await req.json().catch(() => ({}));

    const patch: Partial<PublicVacancy> = {};
    const title = text(body.title, 120);
    if (title !== undefined) { if (!title) return NextResponse.json({ error: 'The vacancy needs a title.' }, { status: 400 }); patch.title = title; }
    const subject = text(body.subject, 80);
    if (subject !== undefined) { if (!subject) return NextResponse.json({ error: 'The vacancy needs a subject.' }, { status: 400 }); patch.subject = subject; }
    if (body.grades !== undefined) {
      const grades = cleanGrades(body.grades);
      if (!grades.length) return NextResponse.json({ error: 'Choose at least one grade.' }, { status: 400 });
      patch.grades = grades;
      patch.segment = segmentFromGrades(grades);
    }
    for (const key of ['board', 'branch', 'location', 'experience_required', 'salary_range'] as const) {
      const v = text(body[key], 120);
      if (v !== undefined) patch[key] = v;
    }
    if (typeof body.target_branch_id === 'string') {
      const school = db.getSchoolById(job.school_id);
      const branch = school?.branches?.find((b) => b.id === body.target_branch_id);
      if (branch) { patch.target_branch_id = branch.id; patch.branch = branch.name; if (branch.location) patch.location = branch.location; }
    }
    const description = text(body.description, 4000);
    if (description !== undefined) patch.description = description;
    for (const key of ['responsibilities', 'requirements', 'perks'] as const) {
      const v = lines(body[key]);
      if (v !== undefined) patch[key] = v;
    }
    if (typeof body.is_urgent === 'boolean') patch.is_urgent = body.is_urgent;
    if (body.status === 'active' || body.status === 'closed') patch.status = body.status;

    const saved = db.updateJob(id, patch);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'JOB_EDITED',
      resource: `Vacancy: ${saved?.title ?? job.title}`,
      details: `Changed ${Object.keys(patch).join(', ') || 'nothing'}.`,
    });
    return NextResponse.json({ success: true, job: saved });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the vacancy.' }, { status: 500 });
  }
}

/** Remove a vacancy. People who already applied keep their applications. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = db.getJobById(id);
    if (!job) return NextResponse.json({ error: 'Vacancy not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(job.school_id, { anyOf: HIRING_TEAM });
    db.deleteJob(id);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'JOB_DELETED',
      resource: `Vacancy: ${job.title}`,
      details: `Removed the ${job.subject} vacancy${job.branch ? ` at ${job.branch}` : ''}.`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not delete the vacancy.' }, { status: 500 });
  }
}
