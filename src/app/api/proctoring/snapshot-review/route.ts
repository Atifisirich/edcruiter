import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, requireCandidate } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { createProctoringEvent } from '@/lib/proctoringEngine';
import { decodeJpegDataUrl, saveSnapshot } from '@/lib/snapshots';
import { logAiUsage } from '@/lib/aiUsage';
import type { StageKey } from '@/lib/types';
import { parseFinding, findingSummary } from '@/lib/snapshotReview';

/**
 * An AI look at one camera picture taken during a test. The small on-device
 * detector only sees a phone held up in plain view; this catches a phone at the
 * edge of the frame, a second person, or the glow of another screen on the face.
 * A finding is recorded with the picture for the reviewer. Nothing is said to
 * the candidate, so they cannot learn what is noticed.
 */

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
const MODEL = 'gemini-flash-lite-latest';

const PROMPT = `This is a webcam picture of a teacher taking an online job test alone. Look only for signs of outside help.
Return JSON only:
{"phone_or_device": boolean, "other_person": boolean, "screen_glow_on_face": boolean, "reading_from_something": boolean, "note": "one short sentence describing exactly what you see that matters, or empty"}
Mark true only when it is clearly visible. Do not comment on the person's looks, clothes or room.`;

export async function POST(req: NextRequest) {
  try {
    const session = await requireCandidate();
    assertSchoolActive(session.schoolId);
    // About one picture a minute is sent; this leaves room for a long test and no more.
    const rl = checkRateLimit(req, `snapshot-review:${session.candidateId}`, { max: 40, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ ok: false, skipped: 'rate' });
    if (!ai) return NextResponse.json({ ok: false, skipped: 'off' });

    const body = await req.json().catch(() => ({}));
    const jpeg = decodeJpegDataUrl(body.image);
    if (!jpeg) return NextResponse.json({ error: 'A small JPEG picture is required.' }, { status: 400 });
    const stage_key = String(body.stage_key || 'written_theory') as StageKey;
    const moment = body.phase === 'prep' ? ' while the question was on screen, before recording' : '';

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } }, { text: PROMPT }] }],
      config: { responseMimeType: 'application/json', temperature: 0 },
    });
    logAiUsage('proctoring:snapshot', response, MODEL);
    const finding = parseFinding(response.text ?? '');
    const summary = finding ? findingSummary(finding) : null;
    if (!summary) return NextResponse.json({ ok: true });

    const details = `AI look at a camera picture${moment}: ${summary}`;
    const event = createProctoringEvent(session.schoolId, session.candidateId, stage_key, 'AI_SNAPSHOT_FLAG', details);
    const snapshot_url = saveSnapshot(session.schoolId, session.candidateId, 'evidence', jpeg) ?? undefined;
    db.addProctoringEvent(snapshot_url ? { ...event, snapshot_url } : event);
    // The page is told only that the picture was looked at, not what was found.
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not review the picture.' }, { status: 500 });
  }
}
