import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { MAX_SET_ASIDE_PER_REQUEST, isNotResponding, moveBack, setAside, setAsideProblem } from '@/lib/notResponding';

/**
 * Moves candidates who never answer into "Not responding", or back to the main
 * list. HR and the school admin. Nothing is deleted. Setting someone aside also
 * cancels the AI calls planned for them (scheduled calls, retries, call-backs);
 * the sweeper skips them too while they are set aside. Moving them back starts
 * nothing on its own: HR calls or invites them again when they choose.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    const rl = checkRateLimit(req, 'not-responding', { max: 120, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many changes this hour. Try again shortly.' }, { status: 429 });

    const action = body.action === 'move_back' ? 'move_back' : body.action === 'set_aside' ? 'set_aside' : null;
    if (!action) return NextResponse.json({ error: 'Choose what to do.' }, { status: 400 });
    const ids: string[] = Array.isArray(body.candidate_ids)
      ? [...new Set<string>(body.candidate_ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0))]
      : [];
    if (ids.length === 0) return NextResponse.json({ error: 'Choose at least one candidate.' }, { status: 400 });
    if (ids.length > MAX_SET_ASIDE_PER_REQUEST) {
      return NextResponse.json({ error: `Move at most ${MAX_SET_ASIDE_PER_REQUEST} candidates at a time.` }, { status: 400 });
    }

    const now = new Date().toISOString();
    const done: string[] = [];
    const skipped: { id: string; name: string; reason: string }[] = [];
    for (const id of ids) {
      const candidate = db.getCandidateById(ctx.schoolId, id);
      if (!candidate) { skipped.push({ id, name: id, reason: 'Not found.' }); continue; }
      if (action === 'set_aside') {
        const problem = setAsideProblem(candidate);
        if (problem) { skipped.push({ id, name: candidate.name, reason: problem }); continue; }
        db.updateCandidate(ctx.schoolId, id, setAside({ id: ctx.user.id, name: ctx.user.name }, now));
        // Stop the calls already planned for them.
        for (const call of db.getScreeningCallsBySchool(ctx.schoolId, id)) {
          if (call.status === 'scheduled') {
            db.updateScreeningCall(call.id, { status: 'skipped', failure_reason: `Not called: ${ctx.user.name} moved them to Not responding.`, ended_at: now });
          } else if (call.decision?.action === 'retry_scheduled' || call.decision?.action === 'callback_scheduled') {
            db.updateScreeningCall(call.id, { decision: { action: 'none', detail: `Not tried again: ${ctx.user.name} moved them to Not responding.`, at: now } });
          }
        }
      } else {
        if (!isNotResponding(candidate)) { skipped.push({ id, name: candidate.name, reason: 'Already in the main list.' }); continue; }
        db.updateCandidate(ctx.schoolId, id, moveBack());
      }
      done.push(candidate.name);
    }

    if (done.length) {
      auditAsStaff(ctx, ctx.schoolId, {
        action: action === 'set_aside' ? 'CANDIDATES_SET_ASIDE' : 'CANDIDATES_MOVED_BACK',
        resource: `${done.length} ${done.length === 1 ? 'candidate' : 'candidates'}`,
        details: `${action === 'set_aside' ? 'Moved to Not responding' : 'Moved back to the main list'}: ${done.slice(0, 10).join(', ')}${done.length > 10 ? ' and more' : ''}.`,
      });
    }
    return NextResponse.json({ success: true, moved: done.length, skipped });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not move those candidates.' }, { status: 500 });
  }
}
