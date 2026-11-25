import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { MODE_LABEL, cleanMode, modeOf, pathChangeProblem } from '@/lib/interviewMode';

/**
 * HR (or the school admin) changes the path of one candidate: for example, give
 * them only the AI conversational interview instead of the written test and
 * videos. `{ interview_mode: 'ai' | 'five_stage' | 'both' }`, or
 * `{ interview_mode: 'vacancy' }` to go back to what their vacancy asks for.
 * What they already finished is kept. Inviting them to the interview is a
 * separate step (POST /api/voice-interview, action "invite").
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = db.getCandidateByIdPublic(id);
    if (!found) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(found.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'interview-mode', { max: 120, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many changes this hour. Try again shortly.' }, { status: 429 });

    const candidate = db.getCandidateById(ctx.schoolId, id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const vacancy = candidate.job_id ? db.getJobById(candidate.job_id) : undefined;
    const next = body.interview_mode === 'vacancy' ? modeOf(vacancy) : cleanMode(body.interview_mode);
    if (!next) return NextResponse.json({ error: 'Choose what the candidate goes through.' }, { status: 400 });

    const problem = pathChangeProblem(candidate, next);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const before = modeOf(candidate);
    const updated = db.updateCandidate(ctx.schoolId, id, { interview_mode: next });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'CANDIDATE_PATH_CHANGED',
      resource: `Candidate: ${candidate.name}`,
      details: `Changed from "${MODE_LABEL[before]}" to "${MODE_LABEL[next]}".`,
    });
    return NextResponse.json({ interview_mode: updated?.interview_mode ?? next });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not change that.' }, { status: 500 });
  }
}
