import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { AuthError, assertSchoolActive, auditAsStaff, authErrorResponse, requireCandidateOrStaff } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { generateTeachingProfile, isGeneratingProfile } from '@/lib/profileGenerator';
import { reportSettingsOf } from '@/lib/teachingProfile';

/**
 * The teaching profile is a school's view of a candidate. The candidate who is
 * being assessed never sees it, so this refuses a candidate session outright.
 */
async function requireStaffForCandidate(candidateId: string) {
  const access = await requireCandidateOrStaff(candidateId);
  if (access.kind !== 'staff') {
    throw new AuthError('Only the school can view this report.', 403);
  }
  return access;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireStaffForCandidate(id);
    const school = db.getSchoolById(access.schoolId);
    return NextResponse.json({
      profile: db.getTeachingProfile(access.schoolId, id) ?? null,
      generating: isGeneratingProfile(access.schoolId, id),
      shortlist_bands: school?.shortlist_bands ?? null,
      settings: reportSettingsOf(school?.report_settings),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load the profile' }, { status: 500 });
  }
}

/** Writes the profile again. It runs in the background; the page checks back until it is done. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const access = await requireStaffForCandidate(id);
    assertSchoolActive(access.schoolId);

    const rl = checkRateLimit(req, 'teaching-profile', { max: 20, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many refreshes this hour. Try again shortly.' }, { status: 429 });
    }

    const candidate = db.getCandidateById(access.schoolId, id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    if (!isGeneratingProfile(access.schoolId, id)) {
      auditAsStaff(access.ctx, access.schoolId, {
        action: 'TEACHING_PROFILE_REQUESTED',
        resource: `Candidate: ${candidate.name}`,
        details: 'Asked for the AI teaching profile to be written again.',
      });
      after(async () => {
        await generateTeachingProfile(access.schoolId, id);
      });
    }

    return NextResponse.json({ started: true }, { status: 202 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to start the profile' }, { status: 500 });
  }
}
