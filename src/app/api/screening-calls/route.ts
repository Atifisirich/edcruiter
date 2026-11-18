import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { ensureRetrySweeper, startScreeningCall } from '@/lib/screeningCallService';

const MAX_PER_REQUEST = 50;

/**
 * AI screening calls.
 *   GET  ?school_id=…[&candidate_id=…]   the school's calls, newest first
 *   POST { school_id, candidate_ids }    call these candidates now (admin and HR)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ctx = await requireSchoolAccess(url.searchParams.get('school_id'));
    ensureRetrySweeper();
    const calls = db.getScreeningCallsBySchool(ctx.schoolId, url.searchParams.get('candidate_id') || undefined);
    // The platform's own cost is the owner's business, not the school's.
    return NextResponse.json({ calls: ctx.isSuperAdmin ? calls : calls.map(({ cost_inr: _cost, ...c }) => c) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the calls.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'screening-call', { max: 200, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many calls this hour. Try again later.' }, { status: 429 });

    const ids: string[] = Array.isArray(body.candidate_ids)
      ? [...new Set<string>(body.candidate_ids.filter((x: unknown): x is string => typeof x === 'string'))]
      : [];
    if (ids.length === 0) return NextResponse.json({ error: 'Choose at least one candidate.' }, { status: 400 });
    if (ids.length > MAX_PER_REQUEST) return NextResponse.json({ error: `Call at most ${MAX_PER_REQUEST} candidates at a time.` }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const started = [];
    const problems: { candidate_id: string; error: string }[] = [];
    for (const id of ids) {
      const candidate = db.getCandidateById(ctx.schoolId, id);
      if (!candidate) { problems.push({ candidate_id: id, error: 'Candidate not found.' }); continue; }
      const result = await startScreeningCall(ctx.schoolId, candidate, { requestedBy: ctx.user.name, trigger: 'manual', appUrl });
      if (result.ok) {
        started.push(result.call);
        auditAsStaff(ctx, ctx.schoolId, {
          action: 'SCREENING_CALL_STARTED',
          resource: `Candidate: ${candidate.name}`,
          details: result.call.mode === 'demo' ? `Ran a demo AI screening call (no phone call) for ${candidate.name}.` : `Started an AI screening call to ${candidate.name}.`,
        });
      } else {
        problems.push({ candidate_id: result.candidateId, error: result.error });
      }
    }
    return NextResponse.json({ started, problems }, { status: started.length ? 200 : 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not start the calls.' }, { status: 500 });
  }
}
