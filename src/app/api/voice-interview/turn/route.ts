import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireCandidateOrStaff } from '@/lib/auth';
import { addUsage, ownEngine, pcmFromUpload, runTurn, type TurnEvent } from '@/lib/voice/interviewEngine';

/** At most 2 minutes of 16 kHz 16-bit audio in one answer. */
const MAX_BYTES = 2 * 60 * 16_000 * 2 + 44;
/** One turn at a time per interview. A turn cancelled by the candidate speaking again lets go of it at once. */
const busy = new Map<string, Promise<void>>();

/**
 * One turn of the own-pipeline AI interview.
 *   POST ?candidate_id=…&interview_id=…[&silence=1]   body: the candidate's answer as raw 16-bit 16 kHz audio (empty for the opening)
 * Replies with a stream of JSON lines: what was heard, then each sentence to say with its audio, then "end" when the interview is over.
 * The turn is saved only when it finishes, so a turn the candidate cut off by speaking again leaves no trace.
 */
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const candidateId = url.searchParams.get('candidate_id') || '';
    const interviewId = url.searchParams.get('interview_id') || '';
    const silence = url.searchParams.get('silence') === '1';
    const access = await requireCandidateOrStaff(candidateId);
    const candidate = db.getCandidateById(access.schoolId, candidateId);
    const interview = candidate?.ai_interview;
    if (!candidate || !interview || interview.id !== interviewId) return NextResponse.json({ error: 'This interview is no longer current.' }, { status: 409 });
    if (interview.status !== 'in_progress' || interview.engine !== 'own') return NextResponse.json({ error: 'This interview is not running.' }, { status: 409 });
    const engine = ownEngine();
    if (!engine) return NextResponse.json({ error: 'The AI interview is not switched on yet.' }, { status: 503 });

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: 'That answer was too long to send at once.' }, { status: 413 });
    const audio = bytes.length ? pcmFromUpload(bytes) : null;
    if (bytes.length && !audio) return NextResponse.json({ error: 'The audio could not be read.' }, { status: 400 });
    const school = db.getSchoolById(candidate.school_id);

    // Wait briefly for a turn this one replaces (the candidate carried on talking) to let go.
    for (let i = 0; i < 40 && busy.has(interviewId); i++) await new Promise((r) => setTimeout(r, 100));
    if (busy.has(interviewId)) return NextResponse.json({ error: 'Still working on your last answer.' }, { status: 429 });

    const encoder = new TextEncoder();
    let release: () => void = () => undefined;
    busy.set(interviewId, new Promise<void>((r) => { release = r; }));
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (e: TurnEvent) => { try { controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`)); } catch { /* the browser went away */ } };
        try {
          const result = await runTurn({ engine, interview, candidate, schoolName: school?.name || 'the school', audio: audio ?? undefined, silence, signal: req.signal }, emit);
          if (req.signal.aborted) return;
          // Saved from the latest copy, so nothing that changed meanwhile is lost.
          const fresh = db.getCandidateById(candidate.school_id, candidate.id)?.ai_interview;
          if (!fresh || fresh.id !== interviewId || fresh.status !== 'in_progress') return;
          const turns = [...fresh.transcript];
          if (result.heard) turns.push({ role: 'user', text: result.heard });
          if (result.said.length) turns.push({ role: 'agent', text: result.said.join(' ') });
          db.updateCandidate(candidate.school_id, candidate.id, {
            ai_interview: {
              ...fresh,
              transcript: turns.slice(-400),
              usage: addUsage(fresh.usage, result.usage, engine.brain),
              silent_turns: silence ? (fresh.silent_turns ?? 0) + 1 : 0,
            },
          });
        } catch (e) {
          if (!req.signal.aborted) {
            console.warn('Interview turn failed:', e instanceof Error ? e.message : e);
            emit({ type: 'error', message: 'Asha could not answer just now. Please say that again.' });
          }
        } finally {
          busy.delete(interviewId);
          release();
          try { controller.close(); } catch { /* already closed */ }
        }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'The interview turn failed.' }, { status: 500 });
  }
}
