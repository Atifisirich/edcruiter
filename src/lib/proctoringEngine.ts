import { ProctoringEvent, ProctoringEventType, StageKey } from './types';

export interface ProctoringSession {
  candidateId: string;
  stageKey: StageKey;
  startedAt: string; // ISO string
  durationSeconds: number;
}

export function calculateTimeRemaining(session: ProctoringSession): { secondsRemaining: number; isExpired: boolean } {
  const start = new Date(session.startedAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / 1000);
  const remaining = session.durationSeconds - elapsed;
  
  return {
    secondsRemaining: Math.max(0, remaining),
    isExpired: remaining <= 0
  };
}

/**
 * Per-violation point deduction used to turn a raw event log into a single
 * authenticity score for the report view. A reviewer scanning a list of
 * flags has no quick way to judge "is this candidate basically fine with
 * one tab switch, or seriously suspect" without reading every row and
 * weighing it themselves — this gives that first read. Weights are ordered
 * by how strongly each event implies active cheating vs. an incidental
 * glitch: a camera briefly losing a face (lighting, a shifted chair) costs
 * far less than a second face or a phone entering frame.
 */
const VIOLATION_WEIGHTS: Record<ProctoringEventType, number> = {
  WEBCAM_SNAPSHOT: 0, // periodic capture, not a violation
  TIMEOUT: 5,
  FACE_NOT_DETECTED: 5,
  GAZE_OFF_SCREEN: 5,
  VOICE_PROCTOR_WARNING: 5,
  LOOKING_DOWN_AT_DEVICE: 8,
  TAB_SWITCH: 8,
  // Another window or an overlay took focus without the tab changing, or a
  // second screen is attached. Worth a look, not proof of cheating.
  FOCUS_LOST: 6,
  MULTIPLE_DISPLAYS: 6,
  // The camera was unplugged, covered or taken by another app mid-test.
  CAMERA_LOST: 8,
  // The gaze baseline was reset. A reset is allowed twice; each one is noted.
  RECALIBRATED: 3,
  // A large block of text appeared at once (autocomplete, dictation or an
  // extension). Paste and drop are blocked outright and count as COPY_PASTE_ATTEMPT.
  TYPING_ANOMALY: 6,
  FULLSCREEN_EXIT: 10,
  COPY_PASTE_ATTEMPT: 10,
  OBJECT_DETECTED: 10,
  READING_TELEPROMPTER_SUSPECTED: 15,
  PHONE_DETECTED: 20,
  MULTI_FACE_DETECTED: 20,
};

export interface AuthenticityResult {
  score: number; // 0-100
  label: 'High confidence' | 'Mostly authentic' | 'Needs review' | 'Low confidence';
  violationCount: number;
}

export function calculateAuthenticityScore(events: ProctoringEvent[]): AuthenticityResult {
  const violations = events.filter((e) => (VIOLATION_WEIGHTS[e.event_type] ?? 0) > 0);
  const deduction = violations.reduce((sum, e) => sum + (VIOLATION_WEIGHTS[e.event_type] ?? 0), 0);
  const score = Math.max(0, Math.min(100, 100 - deduction));

  const label: AuthenticityResult['label'] =
    score >= 90 ? 'High confidence' :
    score >= 70 ? 'Mostly authentic' :
    score >= 40 ? 'Needs review' :
    'Low confidence';

  return { score, label, violationCount: violations.length };
}

export function createProctoringEvent(
  schoolId: string,
  candidateId: string,
  stageKey: StageKey,
  eventType: ProctoringEventType,
  details: string
): ProctoringEvent {
  return {
    id: `proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    school_id: schoolId,
    candidate_id: candidateId,
    stage_key: stageKey,
    event_type: eventType,
    details,
    timestamp: new Date().toISOString()
  };
}
