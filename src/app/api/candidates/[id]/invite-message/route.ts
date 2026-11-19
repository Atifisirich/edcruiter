import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { INVITE_LINK_VALIDITY_SEC, signInLinkFor } from '@/lib/assessmentInvite';
import { applicationMessage } from '@/lib/candidateLink';
import { appOrigin } from '@/lib/googleOAuth';

/**
 * What staff copy to send a candidate: a ready message, and its parts on their
 * own. The link is the candidate's personal sign-in link (opens their
 * application without a password); the application ID is what they type on
 * the sign-in page with their mobile or email if the link has expired.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = db.getCandidateByIdPublic(id);
    if (!found) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(found.school_id);
    const candidate = db.getCandidateById(ctx.schoolId, id);
    const school = db.getSchoolById(ctx.schoolId);
    if (!candidate || !school) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const link = signInLinkFor(candidate);
    const loginUrl = `${appOrigin()}/candidate/login`;
    const validDays = Math.round(INVITE_LINK_VALIDITY_SEC / 86_400);
    const message = applicationMessage({
      firstName: candidate.name.split(' ')[0] || candidate.name,
      schoolName: school.name,
      post: [candidate.applied_subject, 'teacher'].filter(Boolean).join(' '),
      link,
      loginUrl,
      applicationId: candidate.invite_code,
      validDays,
    });

    auditAsStaff(ctx, ctx.schoolId, { action: 'CANDIDATE_LINK_COPIED', resource: `Candidate: ${candidate.name}`, details: 'Copied the sign-in message to send the candidate.' });
    return NextResponse.json({ message, link, application_id: candidate.invite_code || null, login_url: loginUrl, valid_days: validDays });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not make the message.' }, { status: 500 });
  }
}
