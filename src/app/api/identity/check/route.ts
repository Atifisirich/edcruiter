import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, requireCandidate } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { bestDistance, isDescriptor, MISMATCH_RUN, verdictFor } from '@/lib/faceMatch';
import { createProctoringEvent } from '@/lib/proctoringEngine';
import { decodeJpegDataUrl, saveSnapshot } from '@/lib/snapshots';
import type { StageKey } from '@/lib/types';

/** Samples in a row that did not match, per candidate. Memory only: a restart simply starts the count again. */
const streaks = new Map<string, number>();
const lastReported = new Map<string, number>();
const REPORT_EVERY_MS = 60_000;

/**
 * Compares the face on camera with the photo taken at the start. The comparison
 * is done here so the page cannot decide for itself that the face matches. One
 * bad sample proves nothing (light, angle), so a run of them is needed before a
 * flag goes on the record. When a stage is opened (phase "start") the first
 * mismatch is recorded straight away, since the person sitting down is the one
 * who will answer.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireCandidate();
    assertSchoolActive(session.schoolId);

    const rl = checkRateLimit(req, 'identity-check', { max: 900, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ verdict: 'unclear', limited: true });

    const candidate = db.getCandidateById(session.schoolId, session.candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const reference = candidate.face_reference;
    if (!reference || reference.descriptors.length === 0) {
      return NextResponse.json({ verdict: 'unchecked' });
    }

    const body = await req.json().catch(() => ({}));
    if (!isDescriptor(body.descriptor)) return NextResponse.json({ error: 'Invalid face measurement.' }, { status: 400 });
    const phase = body.phase === 'start' ? 'start' : 'live';
    const stage = (typeof body.stage_key === 'string' ? body.stage_key : 'written_theory') as StageKey;

    const d = bestDistance(reference.descriptors, body.descriptor);
    const verdict = verdictFor(d);
    const key = candidate.id;

    if (verdict === 'match') {
      streaks.set(key, 0);
      return NextResponse.json({ verdict });
    }

    let report = false;
    if (verdict === 'mismatch') {
      const run = (streaks.get(key) ?? 0) + 1;
      streaks.set(key, run);
      const recently = Date.now() - (lastReported.get(key) ?? 0) < REPORT_EVERY_MS;
      report = phase === 'start' ? !recently : run >= MISMATCH_RUN && !recently;
    }

    if (report) {
      lastReported.set(key, Date.now());
      const jpeg = decodeJpegDataUrl(body.image);
      const snapshot_url = jpeg ? saveSnapshot(candidate.school_id, candidate.id, 'evidence', jpeg) ?? undefined : undefined;
      const event = createProctoringEvent(
        candidate.school_id, candidate.id, stage, 'IDENTITY_MISMATCH',
        phase === 'start'
          ? `When this stage was opened, the face on camera did not match the photo taken at the start (distance ${d.toFixed(2)}; same person is usually under 0.6).`
          : `The face on camera has not matched the photo taken at the start for several checks in a row (distance ${d.toFixed(2)}; same person is usually under 0.6). A different person may be taking the test.`
      );
      db.addProctoringEvent(snapshot_url ? { ...event, snapshot_url } : event);
    }

    return NextResponse.json({ verdict, reported: report });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not check the face.' }, { status: 500 });
  }
}
