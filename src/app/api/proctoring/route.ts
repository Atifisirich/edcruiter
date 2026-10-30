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
]);

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
    const details = body.details || body.description || '';

    const event = createProctoringEvent(access.schoolId, candidate_id, stage_key, event_type, details);
    db.addProctoringEvent(event);

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to record proctoring event' }, { status: 500 });
  }
}
