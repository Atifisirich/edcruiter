import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createProctoringEvent } from '@/lib/proctoringEngine';
import { ProctoringEventType, StageKey } from '@/lib/types';
import { authErrorResponse, requireCandidate } from '@/lib/auth';

const ALLOWED_EVENTS = new Set<string>([
  'TAB_SWITCH', 'FULLSCREEN_EXIT', 'TIMEOUT', 'WEBCAM_SNAPSHOT', 'COPY_PASTE_ATTEMPT',
  'GAZE_OFF_SCREEN', 'LOOKING_DOWN_AT_DEVICE', 'PHONE_DETECTED',
  'READING_TELEPROMPTER_SUSPECTED', 'VOICE_PROCTOR_WARNING', 'MULTI_FACE_DETECTED',
  'FACE_NOT_DETECTED', 'OBJECT_DETECTED', 'FOCUS_LOST', 'MULTIPLE_DISPLAYS',
  'CAMERA_LOST', 'RECALIBRATED', 'TYPING_ANOMALY',
  'SPEECH_DURING_PREP', 'READING_PATTERN', 'QUESTION_REVIEWED', 'MIC_OFF',
]);

/** Only small named numbers are kept, so the page cannot store anything else here. */
function cleanMetrics(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 12)) {
    const n = Number(v);
    if (/^[a-z_]{1,40}$/.test(k) && Number.isFinite(n)) out[k] = Math.round(n * 10) / 10;
  }
  return Object.keys(out).length ? out : undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidate_id = body.candidate_id;
    if (!candidate_id) {
      return NextResponse.json({ error: 'candidate_id is required' }, { status: 400 });
    }

    const access = await requireCandidate(candidate_id);

    const stage_key = (body.stage_key || 'written_theory') as StageKey;
    const rawType = String(body.event_type || body.type || 'VOICE_PROCTOR_WARNING');
    const event_type = (ALLOWED_EVENTS.has(rawType) ? rawType : 'VOICE_PROCTOR_WARNING') as ProctoringEventType;
    const details = String(body.details || body.description || '').slice(0, 500);

    const event = createProctoringEvent(access.schoolId, candidate_id, stage_key, event_type, details);
    const metrics = cleanMetrics(body.metrics);
    if (metrics) event.metrics = metrics;
    db.addProctoringEvent(event);

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to record proctoring event' }, { status: 500 });
  }
}
