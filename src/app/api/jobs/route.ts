import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SLOKA_DEFAULT_SCHOOL } from '@/lib/defaultData';
import { PublicVacancy } from '@/lib/types';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');

    // Without school_id this is the public job board — no auth required.
    if (!schoolId) {
      return NextResponse.json({ jobs: db.getPublicJobs() });
    }

    // With school_id this is a school's own vacancy list, which can include
    // drafts and closed postings — staff of that school only.
    const ctx = await requireSchoolAccess(schoolId);
    return NextResponse.json({ jobs: db.getJobsBySchool(ctx.schoolId) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to list vacancies' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    const school = db.getSchoolById(ctx.schoolId);

    if (!body.title || !body.subject || !body.segment) {
      return NextResponse.json({ error: 'title, subject and segment are required' }, { status: 400 });
    }

    const job: PublicVacancy = {
      id: body.id || `job_${Date.now()}`,
      school_id: ctx.schoolId,
      school_name: body.school_name || school?.name || SLOKA_DEFAULT_SCHOOL.name,
      school_type: body.school_type || school?.curriculum_guidelines?.board,
      title: body.title,
      subject: body.subject,
      segment: body.segment,
      board: body.board,
      location: body.location || 'Hyderabad, Telangana',
      branch: body.branch,
      experience_required: body.experience_required || body.experience,
      salary_range: body.salary_range,
      posted_date: 'Just now',
      description: body.description || body.summary || '',
      responsibilities: body.responsibilities,
      requirements: body.requirements,
      perks: body.perks,
      is_verified: true,
      is_urgent: Boolean(body.is_urgent),
      status: 'active',
      created_at: new Date().toISOString()
    };

    const saved = db.createJob(job);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'JOB_POSTED',
      resource: `Vacancy: ${job.title}`,
      details: `Posted ${job.subject} / ${job.segment} at ${job.branch || 'unspecified branch'}.`
    });
    return NextResponse.json({ success: true, job: saved });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to save vacancy' }, { status: 500 });
  }
}
