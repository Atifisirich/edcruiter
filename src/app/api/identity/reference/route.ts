import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, requireCandidate } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { cleanReferences, referencesAgree } from '@/lib/faceMatch';
import { decodeJpegDataUrl, saveSnapshot } from '@/lib/snapshots';

/**
 * Saves the photo and face measurements taken at the start. Every later stage is
 * compared with them to notice a different person taking the test. They can be
 * retaken only until the first timed stage has been opened; after that they are
 * locked, so a swap cannot be covered by taking a new photo.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireCandidate();
    assertSchoolActive(session.schoolId);

    const rl = checkRateLimit(req, 'identity-reference', { max: 20, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many photo attempts. Try again in a while.' }, { status: 429 });

    const candidate = db.getCandidateById(session.schoolId, session.candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    if (db.getStageAttempts(candidate.school_id, candidate.id).length > 0) {
      return NextResponse.json({ error: 'Your photo is locked once the timed stages have begun.', code: 'locked' }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const jpeg = decodeJpegDataUrl(body.image);
    if (!jpeg) return NextResponse.json({ error: 'The photo could not be read. Please take it again.' }, { status: 400 });

    // The measurements are optional: if the face model could not load on this device, the photo alone is kept for the reviewer.
    const descriptors = body.descriptors === undefined ? [] : cleanReferences(body.descriptors);
    if (descriptors === null) return NextResponse.json({ error: 'The face measurements were not valid. Please take the photo again.' }, { status: 400 });
    if (descriptors.length > 1 && !referencesAgree(descriptors)) {
      return NextResponse.json({ error: 'The photos did not look like the same person. Please look straight at the camera and try again.', code: 'inconsistent' }, { status: 422 });
    }

    const photo_url = saveSnapshot(candidate.school_id, candidate.id, 'face', jpeg);
    if (!photo_url) return NextResponse.json({ error: 'The photo could not be saved.' }, { status: 500 });

    db.updateCandidate(candidate.school_id, candidate.id, {
      face_reference: { photo_url, descriptors, captured_at: new Date().toISOString() },
    });
    return NextResponse.json({ success: true, photo_url, measured: descriptors.length > 0 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the photo.' }, { status: 500 });
  }
}
