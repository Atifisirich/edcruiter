import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError, authErrorResponse, requireCandidateOrStaff } from '@/lib/auth';
import { buildProfilePdf } from '@/lib/profilePdf';

/** The candidate report as a PDF download. Staff of the owning school only. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireCandidateOrStaff(id);
    if (access.kind !== 'staff') throw new AuthError('Only the school can download this report.', 403);

    const candidate = db.getCandidateById(access.schoolId, id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const profile = db.getTeachingProfile(access.schoolId, id);
    if (!profile || profile.status === 'failed') {
      return NextResponse.json({ error: 'The report is not ready yet. Write the AI profile first.' }, { status: 409 });
    }

    const school = db.getSchoolById(access.schoolId);
    const bytes = await buildProfilePdf({
      profile,
      candidate: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email && !candidate.email.endsWith('@lead.local') ? candidate.email : undefined,
        phone: candidate.phone || undefined,
        subject: candidate.applied_subject,
        segment: candidate.applied_segment,
        experience: candidate.experience_band || undefined,
        qualification: candidate.qualification || undefined,
        invite_code: candidate.invite_code,
      },
      schoolName: school?.name || 'Your school',
      bands: school?.shortlist_bands,
    });

    const safeName = candidate.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'candidate';
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Teaching-report-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to build the report' }, { status: 500 });
  }
}
