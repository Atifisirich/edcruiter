import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, requireCandidate } from '@/lib/auth';
import { ensureActivePack } from '@/lib/ensurePack';
import { beginAttempt } from '@/lib/attemptService';
import { ATTEMPT_STAGES, canStart } from '@/lib/stageAttempts';
import type { StageKey } from '@/lib/types';

/**
 * Opens one stage for the signed-in candidate. Their questions are only sent now,
 * not when the page loads, and only for the stage they are about to take. A stage
 * left half way and opened again later gets new questions (see stageAttempts.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireCandidate();
    assertSchoolActive(session.schoolId);
    const body = await req.json().catch(() => ({}));
    const stage = String(body.stage_key || '') as StageKey;
    if (!(ATTEMPT_STAGES as string[]).includes(stage)) {
      return NextResponse.json({ error: 'That stage cannot be started this way.' }, { status: 400 });
    }

    const candidate = db.getCandidateById(session.schoolId, session.candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const done = db.getStageResultsByCandidate(candidate.school_id, candidate.id).map((r) => r.stage_key);
    if (done.includes(stage)) {
      return NextResponse.json({ error: 'You have already finished this stage.', code: 'already_done' }, { status: 409 });
    }
    if (!canStart(stage, done)) {
      return NextResponse.json({ error: 'Please finish the earlier stages first.', code: 'earlier_stage_open' }, { status: 409 });
    }

    const prepared = ensureActivePack(candidate.school_id, candidate.applied_subject, candidate.applied_segment);
    if (prepared.state !== 'ready') {
      return NextResponse.json({ error: 'Your test is still being prepared. Please wait a moment.', code: 'preparing' }, { status: 409 });
    }

    const began = await beginAttempt(candidate, prepared.pack, stage);
    if (!began.ok) {
      return NextResponse.json({
        error: `You have used all ${began.allowed} goes at this stage. The school has been told and can allow another.`,
        code: 'no_goes_left',
      }, { status: 403 });
    }

    return NextResponse.json({
      attempt: { id: began.attempt.id, number: began.attempt.number, resumed: began.resumed, allowed: began.allowed },
      content: began.content,
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not start this stage.' }, { status: 500 });
  }
}
