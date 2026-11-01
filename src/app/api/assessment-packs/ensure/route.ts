import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, requireCandidate } from '@/lib/auth';
import { ensureActivePack } from '@/lib/ensurePack';

/**
 * Whether the signed-in candidate's test is ready. If the school has no test
 * written for their subject and grade level yet, one is written in the
 * background and this answers "preparing" until it is ready, so the candidate
 * waits on a screen that says so instead of being given a different subject's
 * questions.
 *
 * It only says whether the test is ready. The questions themselves are sent
 * when the candidate starts each stage (see /api/stage-attempt), so nobody can
 * read the paper from this page before they sit it.
 */
export async function GET() {
  try {
    const session = await requireCandidate();
    assertSchoolActive(session.schoolId);
    const candidate = db.getCandidateById(session.schoolId, session.candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const result = ensureActivePack(session.schoolId, candidate.applied_subject, candidate.applied_segment);
    if (result.state === 'ready') return NextResponse.json({ state: 'ready' });
    if (result.state === 'failed') return NextResponse.json({ state: 'failed', error: result.error });
    return NextResponse.json({ state: 'preparing' });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not prepare the test.' }, { status: 500 });
  }
}
