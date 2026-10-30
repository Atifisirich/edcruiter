import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = db.getJobById(id);
    // A vacancy of a school that is not approved is not public.
    if (!job || !db.isSchoolActive(job.school_id)) {
      return NextResponse.json({ error: 'Vacancy not found' }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: 'Failed to load vacancy' }, { status: 500 });
  }
}
