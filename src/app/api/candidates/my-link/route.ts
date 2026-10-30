import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireCandidate } from '@/lib/auth';
import { signInLinkFor } from '@/lib/assessmentInvite';

/**
 * The signed-in candidate's own way back in: one link that opens their
 * application on any device for a week, so they can save it instead of copying
 * a code and an email or phone number separately.
 */
export async function GET() {
  try {
    const session = await requireCandidate();
    const candidate = db.getCandidateById(session.schoolId, session.candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    return NextResponse.json({ url: signInLinkFor(candidate) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not make your link.' }, { status: 500 });
  }
}
